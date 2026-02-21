const express = require("express");
const app = express();
app.use(express.json());

// Fullwidth ↔ Halfwidth conversion maps
const FW_START = 0xff01; // ！
const FW_END = 0xff5e;   // ～
const HW_START = 0x0021; // !
const FW_SPACE = 0x3000;
const HW_SPACE = 0x0020;

// Katakana: Halfwidth (FF65-FF9F) ↔ Fullwidth (30A1-30F6)
const hwKatakana = {
  "ｦ":"ヲ","ｧ":"ァ","ｨ":"ィ","ｩ":"ゥ","ｪ":"ェ","ｫ":"ォ","ｬ":"ャ","ｭ":"ュ","ｮ":"ョ","ｯ":"ッ",
  "ｰ":"ー","ｱ":"ア","ｲ":"イ","ｳ":"ウ","ｴ":"エ","ｵ":"オ","ｶ":"カ","ｷ":"キ","ｸ":"ク","ｹ":"ケ",
  "ｺ":"コ","ｻ":"サ","ｼ":"シ","ｽ":"ス","ｾ":"セ","ｿ":"ソ","ﾀ":"タ","ﾁ":"チ","ﾂ":"ツ","ﾃ":"テ",
  "ﾄ":"ト","ﾅ":"ナ","ﾆ":"ニ","ﾇ":"ヌ","ﾈ":"ネ","ﾉ":"ノ","ﾊ":"ハ","ﾋ":"ヒ","ﾌ":"フ","ﾍ":"ヘ",
  "ﾎ":"ホ","ﾏ":"マ","ﾐ":"ミ","ﾑ":"ム","ﾒ":"メ","ﾓ":"モ","ﾔ":"ヤ","ﾕ":"ユ","ﾖ":"ヨ","ﾗ":"ラ",
  "ﾘ":"リ","ﾙ":"ル","ﾚ":"レ","ﾛ":"ロ","ﾜ":"ワ","ﾝ":"ン","ﾞ":"゛","ﾟ":"゜"
};

// Dakuten/Handakuten combinations
const dakuten = {
  "カ":"ガ","キ":"ギ","ク":"グ","ケ":"ゲ","コ":"ゴ",
  "サ":"ザ","シ":"ジ","ス":"ズ","セ":"ゼ","ソ":"ゾ",
  "タ":"ダ","チ":"ヂ","ツ":"ヅ","テ":"デ","ト":"ド",
  "ハ":"バ","ヒ":"ビ","フ":"ブ","ヘ":"ベ","ホ":"ボ","ウ":"ヴ"
};
const handakuten = {"ハ":"パ","ヒ":"ピ","フ":"プ","ヘ":"ペ","ホ":"ポ"};

// Reverse map: fullwidth katakana → halfwidth
const fwToHwKatakana = {};
for (const [hw, fw] of Object.entries(hwKatakana)) fwToHwKatakana[fw] = hw;
for (const [base, combined] of Object.entries(dakuten)) fwToHwKatakana[combined] = fwToHwKatakana[base] + "ﾞ";
for (const [base, combined] of Object.entries(handakuten)) fwToHwKatakana[combined] = fwToHwKatakana[base] + "ﾟ";

function toHalfwidth(text, options = {}) {
  const { ascii = true, katakana = true, space = true } = options;
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const ch = text[i];
    if (ascii && code >= FW_START && code <= FW_END) {
      result += String.fromCharCode(code - FW_START + HW_START);
    } else if (space && code === FW_SPACE) {
      result += " ";
    } else if (katakana && fwToHwKatakana[ch]) {
      result += fwToHwKatakana[ch];
    } else {
      result += ch;
    }
  }
  return result;
}

function toFullwidth(text, options = {}) {
  const { ascii = true, katakana = true, space = true } = options;
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const ch = text[i];
    if (ascii && code >= HW_START && code <= 0x007e) {
      result += String.fromCharCode(code - HW_START + FW_START);
    } else if (space && code === HW_SPACE) {
      result += String.fromCharCode(FW_SPACE);
    } else if (katakana && hwKatakana[ch]) {
      const fw = hwKatakana[ch];
      // Check for dakuten/handakuten
      const next = text[i + 1];
      if (next === "ﾞ" && dakuten[fw]) {
        result += dakuten[fw];
        i++;
      } else if (next === "ﾟ" && handakuten[fw]) {
        result += handakuten[fw];
        i++;
      } else {
        result += fw;
      }
    } else {
      result += ch;
    }
  }
  return result;
}

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "fullwidth-halfwidth-api" });
});

// POST endpoint
app.post("/convert", (req, res) => {
  try {
    const { text, direction = "halfwidth", ascii = true, katakana = true, space = true } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });
    if (!["halfwidth", "fullwidth"].includes(direction)) {
      return res.status(400).json({ error: "direction must be halfwidth or fullwidth" });
    }
    const options = { ascii, katakana, space };
    const result = direction === "halfwidth" ? toHalfwidth(text, options) : toFullwidth(text, options);
    res.json({ result, original: text, direction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET endpoint
app.get("/convert", (req, res) => {
  try {
    const { text, direction = "halfwidth", ascii, katakana, space } = req.query;
    if (!text) return res.status(400).json({ error: "text query parameter is required" });
    const options = {
      ascii: ascii !== "false",
      katakana: katakana !== "false",
      space: space !== "false"
    };
    const result = direction === "halfwidth" ? toHalfwidth(text, options) : toFullwidth(text, options);
    res.json({ result, original: text, direction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Fullwidth-Halfwidth API running on port ${PORT}`));
