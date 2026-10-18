import { emptySong, newPassage, type Song, type Setlist } from "./model";
function demo(
  id: string,
  title: string,
  duration: number,
  intro: number,
  bpm: number,
  sections: [string, string, number][],
): Song {
  return {
    ...emptySong(),
    id,
    title,
    artist: "The Afterhours",
    duration,
    intro,
    bpm,
    lyricSource: { type: "original-demo" },
    notes:
      "Original CueLine demo. Make it your own.\nKeep the ending open and let it ring.",
    passages: sections.map(([kind, text, start], i) => ({
      ...newPassage(text),
      id: `${id}-p${i}`,
      kind: kind as Song["passages"][number]["kind"],
      start,
      estimated: true,
    })),
  };
}
export const demoSongs = () => [
  demo("demo-amber", "Amber on the Avenue", 212, 8, 96, [
    [
      "verse",
      "The last train hums beneath our feet\nWe trade our shadows with the street",
      8,
    ],
    [
      "verse",
      "A paper moon above the bar\nYou find your way by where we are",
      35,
    ],
    [
      "chorus",
      "Keep a little amber in the night\nKeep a little fire in the fading light\nWhen the whole world turns to blue\nI will find my way to you",
      62,
    ],
    [
      "verse",
      "The city folds its silver wings\nWe leave some room for little things",
      98,
    ],
    ["instrumental", "Guitar solo · 8 bars", 128],
    [
      "chorus",
      "Keep a little amber in the night\nKeep a little fire in the fading light\nWhen the whole world turns to blue\nI will find my way to you",
      153,
    ],
    ["outro", "Let the avenue go quiet\nLeave a little light for me", 188],
  ]),
  demo("demo-tide", "Slow Tide", 186, 0, 74, [
    [
      "verse",
      "Salt on the windows, sand in the hall\nNothing to answer, no one to call",
      0,
    ],
    [
      "chorus",
      "Slow tide, carry me home\nOver the water, wherever we roam",
      32,
    ],
    [
      "verse",
      "I held the morning up to the light\nFound all the colours we lost in the night",
      64,
    ],
    [
      "bridge",
      "Leave all the heavy things here on the shore\nWe have enough, we need nothing more",
      98,
    ],
    [
      "chorus",
      "Slow tide, carry me home\nOver the water, wherever we roam",
      130,
    ],
    ["outro", "Carry me home\nCarry me home", 165],
  ]),
  demo("demo-neon", "Neon Weather", 238, 16, 122, [
    [
      "verse",
      "Rain makes a rhythm on the dashboard\nWe take the turn we never took before",
      16,
    ],
    [
      "chorus",
      "In this neon weather\nWe could drive forever\nEvery light is turning green\nEvery mile is seventeen",
      48,
    ],
    [
      "verse",
      "Your favourite jacket on the backseat\nA little static in the melody",
      84,
    ],
    ["instrumental", "Keys solo · 16 bars", 116],
    ["bridge", "No map, no warning\nJust us, till morning", 148],
    [
      "chorus",
      "In this neon weather\nWe could drive forever\nEvery light is turning green\nEvery mile is seventeen",
      178,
    ],
    [
      "outro",
      "Keep driving into the light\nWe have the rest of the night",
      214,
    ],
  ]),
];
export const demoSetlist = (): Setlist => ({
  id: "demo-set",
  name: "Friday Night · The Local",
  entries: ["demo-amber", "demo-tide", "demo-neon"].map((songId, i) => ({
    id: `demo-entry-${i}`,
    songId,
  })),
  updatedAt: Date.now(),
});
