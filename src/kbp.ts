import { IStyle, IConfig, ISentence, ISyllable } from "./types";

export default class KBPParser {
  config: IConfig;
  track: ISentence[];
  styles: IStyle[] = [];

  constructor(config: IConfig) {
    this.config = config;
    this.track = [];
  }

  // Convert a 3-hex-digit RGB color to an 8-digit ABGR (backwards RGBA)
  kbp2AssColor(palette: string[], index: number) {
    // If transparency mode is on, if the palette color used is the background
    // (always index 0 in kbp format), do not display (full transparency)
    const start = index == 0 && this.config.transparency ? "&HFF" : "&H00";
    return (
      start +
      palette[index]
        .split("")
        .reverse()
        .map(function (hex) {
          return hex + hex;
        })
        .join("")
    );
  }

  getAlignement(element: string) {
    let alignment = 8;
    if (element === "C") {
      alignment = 8;
    } else if (element === "L") {
      alignment = 7;
    } else if (element === "R") {
      alignment = 9;
    }
    return alignment;
  }

  /**
   * Parse an KBP text file
   * @param {string} file KBP text file content
   */
  parse(file: string) {
    // Lyric match regex like ZA/						592/622/0
    let regex = /(.*)\/ *([0-9]+)\/([0-9]+)\/([0-9]+)/g;

    if (file.match(regex)?.length === 0) {
      throw "Invalid KaraokeBuilder file";
    }

    // Let's parse the file line by line
    let lines = file.replace(/\r+/g, "").split("\n");

    let sentenceID = 1; // Current sentence ID
    let trackID = 1; // Current track ID
    let currentStart = null; // Start of the current sentence (milliseconds)
    let currentEnd = null; // End of the previous sentence (milliseconds)
    let syllables = []; // Syllables list of the current sentence
    let colours = null; // list of colours
    let currentStyle = null; // Current style

    // Below are defaults from KBS, they should get replaced by the Margins config line
    let leftMargin = 2;
    let rightMargin = 2;
    let topMargin = 7 + (this.config.border ? 12 : 0); // margin from KBS plus CDG top border
    let lineSpacing = 12 + 19; // the effective line spacing seems to add 19 pixels to the value set in KBS

    const totalWidth = this.config.border ? 300 : 288;

    // not set until a page starts
    let currentPos = null;
    let currentOffset = null;
    let horizontalPos = null;
    let currentAlignment = null;
    let defaultWipeProgressive = null;
    let fixed = null;

    let offsetms = Math.floor(this.config.offset ?? 0 * 1000);

    // We split blocks by PAGEV2, and ignore the first one (it is header)
    let blockcount = 0;

    // Parse each line of the file until the end
    for (let i = 0; i < lines.length; i++) {
      // Delete the trailing spaces
      let line: string = lines[i].trimEnd();

      if (line == "PAGEV2") {
        blockcount++;
        currentPos = topMargin - lineSpacing; // line is read before the applicable syllables start, so it will add back lineSpacing
        continue;
      }

      if (line.match(/^'Margins/)?.length ?? 0 > 0) {
        i++;
        [leftMargin, rightMargin, topMargin, lineSpacing] = lines[i]
          .trim()
          .split(",")
          .map(x => parseInt(x));
        topMargin += this.config.border ? 12 : 0;
        // TODO: determine the correct value based on style 0 (style 1 in GUI)
        // 19 is correct for Arial 12 bold, Arial 13, and Arial 13 bold
        lineSpacing += 19;
      }

      if (line.match(/^'Other/)?.length ?? 0 > 0) {
        i++;
        defaultWipeProgressive =
          lines[i].trim().split(",")[1] == "5" ? false : true;
      }

      if (line.match(/^'Palette Colours/)?.length ?? 0 > 0) {
        i++;
        colours = lines[i].trim().split(",");
        continue;
      }

      let matches = line.match(/Style([0-1][0-9])/);
      if (matches && matches.length > 0) {
        // Style numbers can be skipped and possibly don't even need to be sequential
        let index = parseInt(matches[1]);
        // first line of style
        let element = line.split(",");
        let style: IStyle = {
          Name: `${element[0]}_${element[1]}`,
          PrimaryColour: this.kbp2AssColor(colours!, parseInt(element[4])),
          SecondaryColour: this.kbp2AssColor(colours!, parseInt(element[2])),
          OutlineColour: this.kbp2AssColor(colours!, parseInt(element[3])),
          BackColour: this.kbp2AssColor(colours!, parseInt(element[5])),
        };
        i++;
        // second line of style
        element = lines[i].trim().split(",");
        style.Fontname = element[0];

        // TODO: improve this based on font used
        // Font size in .kbp refers to the cap height, whereas in .ass it
        // refers to the line/body height. 1.4 seems to be close
        // for most normal fonts but ideally this should change to
        // something like this example in Cairo:
        // https://stackoverflow.com/questions/23252321/freetype-sizing-fonts-based-on-cap-height
        style.Fontsize = parseInt(element[1]) * 1.4;

        style.Bold = element[2] === "B" ? -1 : 0;
        style.Italic = element[2] === "I" ? -1 : 0;
        style.StrikeOut = element[2] === "S" ? -1 : 0;
        style.Underline = element[2] === "U" ? -1 : 0;
        style.Encoding = parseInt(element[3]);
        i++;
        // third line of style
        element = lines[i].trim().split(",");
        style.Outline = parseInt(element[0]);
        style.Shadow = parseInt(element[4]);
        this.styles[index] = style;
        continue;
      }

      // Ignore everything before the first block
      if (blockcount == 0) {
        continue;
      }

      // TODO: rotation
      // TODO: transitions?
      if (line.match(/[LCR]\/[A-Za-z]/g)?.length ?? 0 > 0) {
        let element = line.split("/");
        if (currentPos === null) {
          currentPos = lineSpacing;
        } else {
          currentPos += lineSpacing;
        }

        currentOffset = parseInt(element[5]);
        currentAlignment = this.getAlignement(element[0]);
        horizontalPos =
          ((currentAlignment - 7) * totalWidth) / 2 +
          parseInt(element[4]) +
          (8 - currentAlignment) *
            ((currentAlignment == 7 ? leftMargin : rightMargin) +
              (this.config.border ? 6 : 0));
        if (element[2] !== "0" && element[3] !== "0") {
          this.styles[element[1].toUpperCase().charCodeAt(0) - 65].Alignment =
            currentAlignment;
          currentStyle =
            this.styles[element[1].toUpperCase().charCodeAt(0) - 65].Name;
        }
        fixed = element[1].toLowerCase() == element[1];
        currentStart = Math.floor(parseInt(element[2]) * 10) + offsetms;
        if (currentStart < 0) currentStart = 0;
        currentEnd = Math.floor(parseInt(element[3]) * 10) + offsetms;
        if (currentEnd < 0) currentEnd = 0;
        continue;
      }

      // Ignore block separators FX/F/ statements
      if (
        line.startsWith("--------") ||
        line.startsWith("FX/") ||
        line == "PAGEV2" ||
        line == "MODS"
      ) {
        continue;
      }

      // Empty line is end of line
      if (line.replace(/\s*/g, "").length == 0) {
        if (syllables.length > 0) {
          // Create a new sentence
          let sentence = this.makeSentence(
            sentenceID,
            syllables,
            currentStart!,
            currentEnd!,
            currentStyle!,
            currentPos! + currentOffset!,
            horizontalPos!,
            currentAlignment!
          );

          currentStart = null;
          currentEnd = null;

          // Add the sentence to the current track
          if (trackID == 1) {
            this.track.push(sentence);
          }

          // Increment the sentence ID, reset the current sentence syllables
          sentenceID++;
          syllables = [];
        }
        continue;
      }

      // Syllable line
      if (line.match(regex)?.length === 1) {
        var syllable: any = {};

        // Split of the regex result
        let matches = line.split("/");

        // Get the syllable text
        syllable.text = matches[0];

        // A leading space at the start of a line needs to be replaced with a hard break to function
        if (syllables.length == 0)
          syllable.text = syllable.text.replace(/^ /, "\\h");

        // Add the start time of the syllable

        // TODO: Better handling of fixed text. Currently this will just set
        // the time before wiping starts to be the duration of the line to stop it
        // from ever wiping but ideally there should be a fixed version of the
        // style that does not even use \k or \kf
        syllable.start = fixed
          ? currentEnd
          : Math.floor(parseInt(matches[1].trim()) * 10 + offsetms);
        if (syllable.start < 0) syllable.start = 0;
        // Add the duration, end time
        syllable.end = fixed
          ? syllable.start
          : Math.floor(parseInt(matches[2].trim()) * 10 + offsetms);
        if (syllable.end < 0) syllable.end = 0;
        syllable.duration = syllable.end - syllable.start;

        let wipeType = parseInt(matches[3].trim());
        if (wipeType == 0) {
          syllable.wipeProgressive = defaultWipeProgressive;
        } else {
          syllable.wipeProgressive = wipeType >= 5 ? false : true;
        }

        if (syllable.start !== 0 || syllable.end !== 0) {
          // Add the syllable
          syllables.push(syllable);
        }
      }
    }

    return {
      track: this.track,
    };
  }

  /**
   * Make a new sentence
   * @param {number} id          ID of the sentence
   * @param {ISyllable[]}  syllables   Syllables list of the sentence
   * @param {number} start       Start time of the sentence
   * @param {number} end         End time of the sentence
   * @param {number} vpos        Vertical position to draw sentence
   * @param {number} hpos        Horizontal position to draw sentence
   * @param {number} alignment   Text alignment of sentence
   */
  private makeSentence(
    id: number,
    syllables: ISyllable[],
    start: number,
    end: number,
    currentStyle: string,
    vpos: number,
    hpos: number,
    alignment: number
  ): ISentence {
    start = start ?? syllables[0].start;
    end = end ?? syllables[syllables.length - 1].end;
    const duration = end - start;
    return {
      id,
      start,
      end,
      duration,
      currentStyle,
      vpos,
      hpos,
      alignment,
      // Insert sentence syllables as objects or as a string
      syllables: this.config["syllable-precision"] ? syllables : undefined,
      text: this.config["syllable-precision"]
        ? ""
        : syllables.map(s => s.text).join(""),
    };
  }
}
