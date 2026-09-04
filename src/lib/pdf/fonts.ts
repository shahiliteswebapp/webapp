import path from "node:path";
import { Font } from "@react-pdf/renderer";

/*
 * Registers the brand fonts for the generated PDF. TTFs are vendored in
 * src/assets/fonts/ (Montserrat static weights + Cormorant Garamond variable).
 * Runs once per server process.
 */

const dir = path.join(process.cwd(), "src", "assets", "fonts");
let done = false;

export function registerPdfFonts(): void {
  if (done) return;

  Font.register({
    family: "Montserrat",
    fonts: [
      { src: path.join(dir, "Montserrat-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "Montserrat-Medium.ttf"), fontWeight: 500 },
      { src: path.join(dir, "Montserrat-SemiBold.ttf"), fontWeight: 600 },
    ],
  });

  Font.register({
    family: "Cormorant Garamond",
    fonts: [{ src: path.join(dir, "CormorantGaramond-Variable.ttf") }],
  });

  // Never hyphenate words across lines in the PDF.
  Font.registerHyphenationCallback((word) => [word]);

  done = true;
}
