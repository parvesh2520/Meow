// Lookups for elements the page markup always provides; optional lookups use document.querySelector directly.
export const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector(selector) as T;
export const all = <T extends HTMLElement = HTMLElement>(selector: string): T[] => [...document.querySelectorAll<T>(selector)];
