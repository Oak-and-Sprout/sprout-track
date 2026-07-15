export interface SpritePose { file: string; label: string }
export interface SpriteSet { id: string; label: string; poses: SpritePose[] }

export const SPRITE_SETS: SpriteSet[] = [
  { id: 'teddy', label: 'Teddy Bears', poses: [
    { file: 'hugging.svg', label: 'Hugging' },
    { file: 'lying-down.svg', label: 'Lying down' },
    { file: 'side-view.svg', label: 'Side view' },
    { file: 'sitting-1.svg', label: 'Sitting 1' },
    { file: 'sitting-2.svg', label: 'Sitting 2' },
    { file: 'waving.svg', label: 'Waving' },
  ]},
  { id: 'kittens', label: 'Kittens', poses: [
    { file: 'back-view.svg', label: 'Back view' },
    { file: 'lying-curled.svg', label: 'Lying curled' },
    { file: 'lying-down.svg', label: 'Lying down' },
    { file: 'paw-raised.svg', label: 'Paw raised' },
    { file: 'sitting.svg', label: 'Sitting' },
    { file: 'stretching.svg', label: 'Stretching' },
  ]},
  { id: 'puppies', label: 'Puppies', poses: [
    { file: 'head-tilted.svg', label: 'Head tilted' },
    { file: 'play-bow.svg', label: 'Play bow' },
    { file: 'rolling-over.svg', label: 'Rolling over' },
    { file: 'sitting.svg', label: 'Sitting' },
    { file: 'sleeping.svg', label: 'Sleeping' },
    { file: 'standing.svg', label: 'Standing' },
  ]},
  { id: 'unicorns', label: 'Unicorns', poses: [
    { file: 'grazing.svg', label: 'Grazing' },
    { file: 'jumping.svg', label: 'Jumping' },
    { file: 'lying-down.svg', label: 'Lying down' },
    { file: 'rearing.svg', label: 'Rearing' },
    { file: 'sitting.svg', label: 'Sitting' },
    { file: 'standing.svg', label: 'Standing' },
  ]},
  { id: 'butterflies', label: 'Butterflies', poses: [
    { file: 'open-wings-1.svg', label: 'Open wings 1' },
    { file: 'open-wings-2.svg', label: 'Open wings 2' },
    { file: 'side-view-1.svg', label: 'Side view 1' },
    { file: 'side-view-2.svg', label: 'Side view 2' },
    { file: 'small.svg', label: 'Small' },
    { file: 'swallowtail.svg', label: 'Swallowtail' },
  ]},
  { id: 'flowers', label: 'Flowers', poses: [
    { file: 'blossom-with-stem.svg', label: 'Blossom with stem' },
    { file: 'daisy-tilted.svg', label: 'Daisy tilted' },
    { file: 'daisy.svg', label: 'Daisy' },
    { file: 'leaf.svg', label: 'Leaf' },
    { file: 'sprig.svg', label: 'Sprig' },
    { file: 'tulip.svg', label: 'Tulip' },
  ]},
  { id: 'rockets', label: 'Rockets', poses: [
    { file: 'flying-diagonal.svg', label: 'Flying diagonal' },
    { file: 'flying-right.svg', label: 'Flying right' },
    { file: 'flying-tilted.svg', label: 'Flying tilted' },
    { file: 'flying-up-1.svg', label: 'Flying up 1' },
    { file: 'flying-up-2.svg', label: 'Flying up 2' },
    { file: 'launching.svg', label: 'Launching' },
  ]},
  { id: 'cars', label: 'Cars', poses: [
    { file: 'bus.svg', label: 'Bus' },
    { file: 'compact-car-tilted.svg', label: 'Compact car tilted' },
    { file: 'compact-car.svg', label: 'Compact car' },
    { file: 'pickup-truck.svg', label: 'Pickup truck' },
    { file: 'race-car.svg', label: 'Race car' },
    { file: 'van.svg', label: 'Van' },
  ]},
  { id: 'balls', label: 'Sports Balls', poses: [
    { file: 'baseball-1.svg', label: 'Baseball 1' },
    { file: 'baseball-2.svg', label: 'Baseball 2' },
    { file: 'basketball-1.svg', label: 'Basketball 1' },
    { file: 'basketball-2.svg', label: 'Basketball 2' },
    { file: 'football-1.svg', label: 'Football 1' },
    { file: 'football-2.svg', label: 'Football 2' },
    { file: 'soccer-1.svg', label: 'Soccer 1' },
    { file: 'soccer-2.svg', label: 'Soccer 2' },
  ]},
  { id: 'stars', label: 'Stars', poses: [
    { file: 'classic.svg', label: 'Classic' },
    { file: 'rounded.svg', label: 'Rounded' },
    { file: 'shooting.svg', label: 'Shooting' },
    { file: 'smiley.svg', label: 'Smiley' },
    { file: 'sparkle.svg', label: 'Sparkle' },
    { file: 'tilted.svg', label: 'Tilted' },
  ]},
  { id: 'fairies', label: 'Fairies', poses: [
    { file: 'back-view.svg', label: 'Back view' },
    { file: 'casting-spell.svg', label: 'Casting spell' },
    { file: 'flying-right.svg', label: 'Flying right' },
    { file: 'flying-swoop.svg', label: 'Flying swoop' },
    { file: 'sitting.svg', label: 'Sitting' },
    { file: 'standing-wand-up.svg', label: 'Standing wand up' },
  ]},
];

export const RUGS = [
  { id: 'rug:paisley-1', label: 'Classic Paisley', file: 'paisley-1.svg' },
  { id: 'rug:paisley-2', label: 'Trailing Paisley', file: 'paisley-2.svg' },
  { id: 'rug:paisley-3', label: 'Garden Paisley', file: 'paisley-3.svg' },
  { id: 'rug:rug-1', label: 'Medallion Rug', file: 'rug-1.svg' },
  { id: 'rug:rug-2', label: 'Heirloom Rug', file: 'rug-2.svg' },
];

export const spriteUrl = (setId: string, file: string) => `/nursery/sprites/${setId}/${file}`;
export const rugUrl = (file: string) => `/nursery/rugs/${file}`;
export const spriteSetById = (id: string) => SPRITE_SETS.find(s => s.id === id);
