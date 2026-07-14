import { cva } from 'class-variance-authority';

export const attachmentStyles = {
  row: cva('flex flex-wrap gap-3'),
  thumb: cva('grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-xl bg-gray-100 shadow-sm'),
  removeBadge: cva('absolute -right-2 -top-2 grid h-[23px] w-[23px] place-items-center rounded-full border-2 border-white bg-slate-700 text-white'),
  addTile: cva('grid h-[84px] w-[84px] place-items-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 hover:border-teal-500 hover:text-teal-700'),
  hint: cva('mt-2 text-xs text-gray-400'),
};
