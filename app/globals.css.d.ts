// src/globals.css.d.ts or app/globals.css.d.ts
declare module '*.css' {
    const content: { [className: string]: string };
    export default content;
}