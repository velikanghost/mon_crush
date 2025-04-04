import * as Tone from "tone";

// Track initialization state
let initialized = false;
let backgroundMusicPlaying = false;

// Audio elements
let comboSynth: Tone.PolySynth | null = null;
let matchSynth: Tone.PolySynth | null = null;

// Lo-fi Music Elements
let lofiSynth: Tone.PolySynth | null = null;
let lofiBeatSynth: Tone.MembraneSynth | null = null;
let lofiNoise: Tone.Noise | null = null;
let lofiReverb: Tone.Reverb | null = null;
let lofiFilter: Tone.Filter | null = null;
let lofiDistortion: Tone.Distortion | null = null;
let lofiBass: Tone.Synth | null = null;
let lofiCompressor: Tone.Compressor | null = null;
let lofiPatternLoop: Tone.Loop | null = null;
let lofiNoiseLoop: Tone.Loop | null = null;
let lofiDrumPatternPart: Tone.Part | null = null;
let lofiBassPatternPart: Tone.Part | null = null;

/**
 * Initialize the Tone.js audio context and set up audio elements
 * Must be called after user interaction due to browser autoplay policy
 */
export async function initGameAudio(): Promise<void> {
  if (initialized) return;

  try {
    // Start Tone.js context
    await Tone.start();
    console.log("Audio context started");

    // Set global volume
    Tone.Destination.volume.value = -10; // Lower volume (in dB)

    // ==== EFFECTS CHAIN SETUP ====

    // Master compressor
    lofiCompressor = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.005,
      release: 0.1,
    }).toDestination();

    // Reverb for lo-fi sound
    lofiReverb = new Tone.Reverb({
      decay: 3,
      wet: 0.35,
      preDelay: 0.01,
    }).connect(lofiCompressor);

    // Distortion for vinyl-like warmth
    lofiDistortion = new Tone.Distortion({
      distortion: 0.05,
      wet: 0.1,
    }).connect(lofiReverb);

    // Filter to create lo-fi vibe
    lofiFilter = new Tone.Filter({
      frequency: 2000,
      type: "lowpass",
      rolloff: -24,
      Q: 0.9,
    }).connect(lofiDistortion);

    // ==== INSTRUMENTS SETUP ====

    // Lo-fi piano synth
    lofiSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "triangle",
      },
      envelope: {
        attack: 0.05,
        decay: 0.3,
        sustain: 0.4,
        release: 1.5,
      },
      volume: -14,
    }).connect(lofiFilter);

    // Bass synth
    lofiBass = new Tone.Synth({
      oscillator: {
        type: "sine",
      },
      envelope: {
        attack: 0.05,
        decay: 0.2,
        sustain: 0.8,
        release: 0.5,
      },
      volume: -16,
    }).connect(lofiFilter);

    // Drum synth
    lofiBeatSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      oscillator: {
        type: "sine",
      },
      envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0.01,
        release: 0.8,
      },
      volume: -14,
    }).connect(lofiFilter);

    // Vinyl noise
    lofiNoise = new Tone.Noise({
      type: "pink",
      volume: -32,
    }).connect(lofiFilter);

    // ==== GAME SOUND SYNTHS ====

    // Combo sound synth
    comboSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "triangle",
      },
      envelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.3,
        release: 1,
      },
      volume: -10,
    }).connect(lofiFilter);

    // Match sound synth - complementary to combo synth
    matchSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "sine",
      },
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.1,
        release: 0.5,
      },
      volume: -12,
    }).connect(lofiFilter);

    // Set up initial transport BPM for lo-fi music
    Tone.Transport.bpm.value = 75;

    // Set up the lo-fi patterns
    setupLofiPatterns();

    initialized = true;
    console.log("Game audio initialized");
  } catch (error) {
    console.error("Failed to initialize audio:", error);
  }
}

/**
 * Set up the patterns for the lo-fi background music
 */
function setupLofiPatterns(): void {
  if (!lofiSynth || !lofiBeatSynth || !lofiBass || !lofiNoise) return;

  // Define lo-fi chord progression
  const chords = [
    ["F3", "A3", "C4", "E4"], // FMaj7
    ["D3", "F3", "A3", "C4"], // Dmin7
    ["C3", "E3", "G3", "B3"], // CMaj7
    ["A2", "C3", "E3", "G3"], // Amin7
  ];

  // Define bass notes to accompany chords
  const bassNotes = ["F2", "D2", "C2", "A1"];

  // Drum pattern - kick on 1 and 3, snare on 2 and 4, with some hi-hat variations
  const drumPattern = [
    { time: "0:0", note: "C1", velocity: 0.8 },
    { time: "0:1", note: "C2", velocity: 0.6 },
    { time: "0:2", note: "C1", velocity: 0.7 },
    { time: "0:3", note: "C2", velocity: 0.5 },
    { time: "0:0:2", note: "C3", velocity: 0.3 },
    { time: "0:1:2", note: "C3", velocity: 0.3 },
    { time: "0:2:2", note: "C3", velocity: 0.3 },
    { time: "0:3:2", note: "C3", velocity: 0.3 },
  ];

  // Create parts for patterns

  // Chord pattern - 2 bars per chord
  let currentChordIndex = 0;
  lofiPatternLoop = new Tone.Loop(time => {
    const chord = chords[currentChordIndex];
    // Random slight timing and velocity variations for human feel
    const delay = Math.random() * 0.02;
    const velocity = 0.6 + Math.random() * 0.2;

    // Play the chord
    lofiSynth?.triggerAttackRelease(chord, "2m", time + delay, velocity);

    // Advance to next chord
    currentChordIndex = (currentChordIndex + 1) % chords.length;
  }, "2m").start(0);

  // Bass pattern - plays the root note of each chord
  lofiBassPatternPart = new Tone.Part(
    (time, value) => {
      // Get the bass note for current chord
      const bassNote = bassNotes[currentChordIndex];
      // Play the bass note with subtle timing variations
      lofiBass?.triggerAttackRelease(bassNote, "8n", time + Math.random() * 0.01, 0.7);
    },
    [{ time: "0:0" }, { time: "0:2" }, { time: "1:0" }, { time: "1:2" }],
  ).start(0);
  lofiBassPatternPart.loop = true;
  lofiBassPatternPart.loopEnd = "2m";

  // Drum pattern
  lofiDrumPatternPart = new Tone.Part((time, value) => {
    // Play the drum with the specified velocity
    lofiBeatSynth?.triggerAttackRelease(
      value.note,
      "16n",
      time + Math.random() * 0.01, // Slight random timing
      value.velocity,
    );
  }, drumPattern).start(0);

  lofiDrumPatternPart.loop = true;
  lofiDrumPatternPart.loopEnd = "1m";

  // Vinyl noise with subtle fluctuations
  lofiNoiseLoop = new Tone.Loop(time => {
    // Add subtle volume variations to the noise
    if (lofiNoise) {
      lofiNoise.volume.rampTo(-32 - Math.random() * 4, 2);
    }
  }, "2m").start(0);
}

/**
 * Play the match sound for basic matches
 */
export function playMatchSound(): void {
  if (!initialized || !matchSynth) return;

  try {
    // Simple descending 3-note pattern that complements the combo sound
    const now = Tone.now();
    matchSynth.triggerAttackRelease("G4", "16n", now, 0.6);
    matchSynth.triggerAttackRelease("E4", "16n", now + 0.06, 0.5);
    matchSynth.triggerAttackRelease("C4", "16n", now + 0.12, 0.4);
  } catch (error) {
    console.error("Error playing match sound:", error);
  }
}

/**
 * Play the combo sound when chain reactions occur
 * @param comboCount Number of combos in the chain (affects the sound)
 */
export function playComboSound(comboCount: number): void {
  if (!initialized || !comboSynth) return;

  try {
    // Base notes for the combo sound
    const baseNote = "C4";
    const comboNotes: string[] = [];

    // Create different notes based on combo count
    if (comboCount <= 3) {
      // Simple ascending arpeggio for small combos
      comboNotes.push(baseNote, "E4", "G4");
    } else if (comboCount <= 6) {
      // More exciting arpeggio for medium combos
      comboNotes.push(baseNote, "E4", "G4", "B4", "D5");
    } else {
      // Major scale run for big combos
      comboNotes.push(baseNote, "D4", "E4", "F4", "G4", "A4", "B4", "C5");
    }

    // Play the notes as an arpeggio
    const now = Tone.now();
    comboNotes.forEach((note, index) => {
      comboSynth?.triggerAttackRelease(note, "16n", now + index * 0.08, 0.5 + Math.min(0.4, comboCount * 0.05));
    });
  } catch (error) {
    console.error("Error playing combo sound:", error);
  }
}

/**
 * Toggle background music on/off
 * @returns Current state of background music after toggling
 */
export function toggleBackgroundMusic(): boolean {
  if (!initialized) return false;

  try {
    if (backgroundMusicPlaying) {
      stopBackgroundMusic();
    } else {
      startBackgroundMusic();
    }

    return backgroundMusicPlaying;
  } catch (error) {
    console.error("Error toggling background music:", error);
    return backgroundMusicPlaying;
  }
}

/**
 * Start playing the lo-fi background music
 */
export function startBackgroundMusic(): void {
  if (!initialized || backgroundMusicPlaying) return;

  try {
    // Start the vinyl noise
    lofiNoise?.start();

    // Start the transport to get everything playing in sync
    Tone.Transport.start();

    backgroundMusicPlaying = true;
    console.log("Background music started");
  } catch (error) {
    console.error("Error starting background music:", error);
  }
}

/**
 * Stop the lo-fi background music
 */
export function stopBackgroundMusic(): void {
  if (!initialized || !backgroundMusicPlaying) return;

  try {
    // Stop the vinyl noise
    lofiNoise?.stop();

    // Stop the transport
    Tone.Transport.stop();

    backgroundMusicPlaying = false;
    console.log("Background music stopped");
  } catch (error) {
    console.error("Error stopping background music:", error);
  }
}

/**
 * Set the volume of all game audio
 * @param volume Volume level from 0 to 1
 */
export function setMasterVolume(volume: number): void {
  if (!initialized) return;

  // Convert 0-1 range to dB (logarithmic)
  const dbVolume = volume === 0 ? -Infinity : 20 * Math.log10(volume);
  Tone.Destination.volume.value = dbVolume;
}

/**
 * Cleanup audio resources when no longer needed
 */
export function cleanupGameAudio(): void {
  if (!initialized) return;

  // Stop background music
  stopBackgroundMusic();

  // Dispose of all loops and patterns
  if (lofiPatternLoop) {
    lofiPatternLoop.dispose();
    lofiPatternLoop = null;
  }

  if (lofiNoiseLoop) {
    lofiNoiseLoop.dispose();
    lofiNoiseLoop = null;
  }

  if (lofiDrumPatternPart) {
    lofiDrumPatternPart.dispose();
    lofiDrumPatternPart = null;
  }

  if (lofiBassPatternPart) {
    lofiBassPatternPart.dispose();
    lofiBassPatternPart = null;
  }

  // Dispose of all Tone.js instruments
  if (lofiSynth) {
    lofiSynth.dispose();
    lofiSynth = null;
  }

  if (lofiBeatSynth) {
    lofiBeatSynth.dispose();
    lofiBeatSynth = null;
  }

  if (lofiBass) {
    lofiBass.dispose();
    lofiBass = null;
  }

  if (lofiNoise) {
    lofiNoise.dispose();
    lofiNoise = null;
  }

  // Dispose of all effects
  if (lofiReverb) {
    lofiReverb.dispose();
    lofiReverb = null;
  }

  if (lofiFilter) {
    lofiFilter.dispose();
    lofiFilter = null;
  }

  if (lofiDistortion) {
    lofiDistortion.dispose();
    lofiDistortion = null;
  }

  if (lofiCompressor) {
    lofiCompressor.dispose();
    lofiCompressor = null;
  }

  // Dispose of game sound synths
  if (comboSynth) {
    comboSynth.dispose();
    comboSynth = null;
  }

  if (matchSynth) {
    matchSynth.dispose();
    matchSynth = null;
  }

  initialized = false;
  backgroundMusicPlaying = false;
}
