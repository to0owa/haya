import { describe as d2, expect as e2, test as t2 } from "bun:test";
import { extendedAnsiLight } from "./themes";

d2("extendedAnsiLight", () => {
  t2("covers indices 16 to 255", () => {
    e2(extendedAnsiLight().length).toBe(240);
  });

  t2("keeps the colour cube unchanged", () => {
    // index 196 is pure red in the standard cube
    e2(extendedAnsiLight()[196 - 16]).toBe("#ff0000");
  });

  t2("inverts white and the greys so they read on a light background", () => {
    const palette = extendedAnsiLight();
    e2(palette[231 - 16]).toBe("#2b333b");
    e2(palette[255 - 16]).toBe("#080808"); // the lightest grey becomes the darkest step
  });
});
