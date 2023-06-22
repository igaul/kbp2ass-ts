#!/usr/bin/env node
import  yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readFileSync } from "node:fs";
import { convertToASS } from "./ass";

async function mainCLI() {
  // Per yargs docs, use of terminalWidth() in typescript requires workaround
  // of assigning a variable name to the instance so it can be referenced
  const yargsInstance = yargs(hideBin(process.argv));

  const argv = yargsInstance
    .scriptName("kbp2ass")
    .parserConfiguration({
      "camel-case-expansion": false,
      "duplicate-arguments-array": false,
      "strip-aliased": true,
    })
    // Unable to use .positional handling because yargs inexplicably treats "$0 foo bar" differently from "$0 -- foo bar"
    .usage(
      `$0 [options] [--] [infile [outfile]]
						$0 [options] infile minimum-progression-duration [--] [outfile] 

						Convert file from KBS project format (.kbp) to SubStation Alpha subtitle (.ass)

						infile:  input file in .kbp format (stdin if not specified)
						outfile: output file in .ass format (stdout if not specified)

						For compatibility with older releases, minimum-progression-duration can be specified as a positional parameter instead of an option (if both are specified, the positional wins). If your output file name happens to be a number, use -- at some point before the second positional parameter to disable this functionality.

						Disable any boolean option with --no-[option]`
    )
    // Used for compatibility with old syntax allowing minimum-progression-duration as a positional
    // .positional only includes items before --, so this is how to tell if the second argument is before -- or not
    .command("* [compat1] [compat2]", false, function (yargs) {
      yargs
        .positional("compat1", {
          type: "string",
        })
        .positional("compat2", {
          type: "string",
        });
    })
    // Despite the fact that the second argument to .command is false,
    // positionals on the "default" command are still shown unless explicitly hidden
    .hide("compat1")
    .hide("compat2")
    .options({
      "syllable-precision": {
        alias: "s",
        description:
          "Highlight syllables individually instead of combining lines into a single string. Disabling this is not recommended.",
        type: "boolean",
        default: true,
        // "nargs: 0" alone doesn't seem to be enough to stop a flag from consuming a parameter next to it
        requiresArg: false,
        nargs: 0,
      },
      "minimum-progression-duration": {
        alias: ["m", "wipe-threshold"],
        description:
          "Set threshold of syllable display time in milliseconds before using progressive wipe effect (implicit default 1000)",
        type: "number",
        requiresArg: true,
      },
      "full-mode": {
        alias: "f",
        description:
          'Enable processing of all positional and style information in the KBS project file (-w, -p, -b, -c). To unset any particular options use --no-{option}. For example, to run in full mode but with no border set, use "-f --no-b" or "--full-mode --no-border".',
        type: "boolean",
        requiresArg: false,
        nargs: 0,
      },
      cdg: {
        alias: "c",
        description:
          "Set the virtual resolution of the destination file to that of CDG graphics, enabling positioning, alignment, and font size to work as they do in KBS.",
        type: "boolean",
        requiresArg: false,
        nargs: 0,
      },
      wipe: {
        alias: "w",
        description:
          "Use wipe setting from project file (progressive wipe effect unless wiping is set to word by word). Sets -m to 0 if not otherwise set.",
        type: "boolean",
        requiresArg: false,
        nargs: 0,
      },
      position: {
        alias: "p",
        description:
          "Use position data from project file. This includes alignment as well as vertical/horizontal offset. Strongly recommended to use with -c option.",
        type: "boolean",
        requiresArg: false,
        nargs: 0,
      },
      border: {
        alias: "b",
        description:
          "Use default CDG border (12 pixels from top of screen). If -c option is used, these are virtual pixels. To use a custom border, set --no-border and add a border in your video editor of choice.",
        type: "boolean",
        requiresArg: false,
        nargs: 0,
      },
    })
    .strictOptions()
    .check(function (argv) {
      // Setting the type only makes it parse it as a number, it doesn't validate the result
      if (isNaN(argv["minimum-progression-duration"])) {
        throw new Error("--minimum-progression-duration must be a number");
      } else if (argv._.length > 2) {
        throw new Error(
          "Maximum of 2 files may be specified (infile and outfile)"
        );
      } else {
        return true;
      }
    })
    .middleware(function (argv) {
      if (argv["full-mode"]) {
        argv = {
          wipe: true,
          position: true,
          border: true,
          cdg: true,
          ...argv,
        };
      }
      if (argv.wipe) {
        argv["minimum-progression-duration"] = 0;
      }
      if ("compat2" in argv) {
        if (isNaN(parseInt(argv.compat2))) {
          argv._.unshift(argv.compat2);
        } else {
          argv["minimum-progression-duration"] = parseInt(argv.compat2);
        }
        delete argv.compat2;
      }
      if ("compat1" in argv) {
        argv._.unshift(argv.compat1);
        delete argv.compat1;
      }
      // "default" functionality from yargs cannot be used because it doesn't show whether a user set the value or the default set it
      const default_opts = ["wipe", "position", "border", "cdg", "full-mode"];
      for (let x in default_opts) {
        const opt = default_opts[x];
        if (!(opt in argv)) argv[opt] = false;
      }
      if (!("minimum-progression-duration" in argv)) {
        argv["minimum-progression-duration"] = 1000;
      }
      return argv;
    }, true)
    .wrap(yargsInstance.terminalWidth()).argv;

  let infile = argv._.shift() || "-";
  const outfile = argv._.shift() || "-";

  delete argv._;
  delete argv["$0"];

  // This should be updated to work on Windows, but it would involve some extra
  // work because even though readFile can take a file descriptor, it doesn't seem
  // to work as expected with process.stdin.fd
  if (infile === "-") infile = "/dev/stdin";

  const txt = readFileSync(infile, "utf8");

  return convertToASS(txt, argv);
  console.log(outfile);
}

if (require.main === module)
  mainCLI()
    .then(data => console.log(data))
    .catch(err => console.error(err));
