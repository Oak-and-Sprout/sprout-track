import { cva } from 'class-variance-authority';

export const cameraCaptureStyles = {
  content: cva('max-w-lg'),
  // The viewfinder well is camera chrome: near-black in both themes.
  well: cva('relative mt-2 aspect-video w-full overflow-hidden rounded-xl bg-gray-950'),
  video: cva('h-full w-full object-contain'),
  capturedImage: cva('absolute inset-0 h-full w-full object-contain'),
  status: cva('absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-300'),
  controls: cva(
    'absolute inset-x-0 bottom-0 grid grid-cols-[1fr_auto_1fr] items-center gap-4 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-10'
  ),
  shutter: cva(
    'group grid h-[68px] w-[68px] place-items-center rounded-full border-2 border-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 disabled:opacity-40'
  ),
  shutterDisc: cva('h-14 w-14 rounded-full bg-white transition-transform duration-100 group-active:scale-90 motion-reduce:transition-none'),
  flipButton: cva(
    'grid h-11 w-11 place-items-center rounded-full text-white/90 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/80'
  ),
  pillGhost: cva(
    'rounded-full bg-white/15 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/80'
  ),
  pillPrimary: cva(
    'rounded-full bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/80'
  ),
};
