# KBP2ASS

This is a converter for [Karaoke Builder Studio](https://www.karaokebuilder.com/kbstudio.php) karaoke format to ASS, written in nodeJS.

## History

These karaokes can now be converted to ASS easily and implemented in projects like [Karaoke Mugen](http://karaokes.moe)

## Installation

Run `npm install -g kbp2ass` to install as a global module (and get the CLI version)

Run `npm install kbp2ass` to install as a module for your project.

## Usage

### Module

As a module here's the method to use it :

#### convertToASS(txt: string, options: {object})

Returns a correctly formatted ASS file as a string. You need to provide the contents of the kbp TXT file as the first parameter and options as the second one.

Options are :

```JS
{
  syllable_precision: boolean,
  minimum_progression_duration: number

}
```

You might want to set `syllable_precision` to `true` to get syllable-timed karaoke instead of sentence-timed karaoke

`minimum_progression_duration` is a duration in milliseconds. 0 is everything is progressive syllabe.
1000 is one second. By default, 500

### CLI

The CLI version is used as follows :

```sh
kbp2ass myfile.txt
```

It produces an ASS file on stdout.

## Build

If you wish to build from source, use `npm run-script build` to get standard JS in the `dist` folder.

## Test

You can test code with the `kbp` file included in the test directory :

```sh
node dist/index.js test/test.kkp
```

## License

MIT
