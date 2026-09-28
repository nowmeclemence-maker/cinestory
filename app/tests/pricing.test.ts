import { describe, expect, test } from "bun:test";
import {
  CREDIT_PACKS,
  DEFAULT_VIDEO_ENGINE_ID,
  IMAGE_SUPPLIER_USD,
  RETAIL_MARKUP,
  SIGNUP_CREDIT_GRANT,
  USD_PER_CREDIT,
  VIDEO_ENGINES,
  clipCredits,
  creditsForSupplierUsd,
  creditsToUsd,
  defaultEngine,
  estimateFilm,
  findEngine,
  imageCredits,
  packMarkup,
  packUsdPerCredit,
} from "../src/lib/services/pricing";

describe("retail credit conversion", () => {
  test("a retail price always covers the supplier cost it was built from", () => {
    for (const engine of VIDEO_ENGINES) {
      for (const seconds of [3, 5, 8, 10, 15]) {
        const supplierUsd = engine.supplierUsdPerSecond * seconds;
        const charged = creditsToUsd(clipCredits(engine, seconds));
        expect(charged).toBeGreaterThan(supplierUsd);
      }
    }
  });

  test("rounds up, so CineStory never absorbs a rounding error", () => {
    // 0.094 * 2 / 0.10 = 1.88 credits of true cost, charged as 2.
    expect(creditsForSupplierUsd(IMAGE_SUPPLIER_USD)).toBe(2);
    expect(creditsToUsd(2)).toBeGreaterThan(IMAGE_SUPPLIER_USD * RETAIL_MARKUP);
  });

  test("a free job costs nothing", () => {
    expect(creditsForSupplierUsd(0)).toBe(0);
  });

  test("prices the whole clip rather than each second", () => {
    // Rounding every second up would charge 5 x ceil(2.24) = 15 instead of 12.
    const kling = findEngine("kling3_0");
    expect(kling).toBeDefined();
    expect(clipCredits(kling!, 5)).toBe(12);
    expect(clipCredits(kling!, 5)).toBeLessThan(5 * creditsForSupplierUsd(kling!.supplierUsdPerSecond));
  });

  test("a longer clip never costs less than a shorter one", () => {
    for (const engine of VIDEO_ENGINES) {
      for (let seconds = 3; seconds < 15; seconds += 1) {
        expect(clipCredits(engine, seconds + 1)).toBeGreaterThanOrEqual(clipCredits(engine, seconds));
      }
    }
  });
});

describe("the engine catalogue", () => {
  test("is ordered cheapest first, so the cheapest option is the visible one", () => {
    const rates = VIDEO_ENGINES.map((engine) => engine.supplierUsdPerSecond);
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
  });

  test("every engine id is unique", () => {
    const ids = VIDEO_ENGINES.map((engine) => engine.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("the default engine exists and is not the most expensive one", () => {
    const engine = defaultEngine();
    expect(engine.id).toBe(DEFAULT_VIDEO_ENGINE_ID);
    const dearest = Math.max(...VIDEO_ENGINES.map((e) => e.supplierUsdPerSecond));
    expect(engine.supplierUsdPerSecond).toBeLessThan(dearest);
  });

  test("an unknown engine id resolves to nothing rather than a wrong price", () => {
    expect(findEngine("no_such_engine")).toBeUndefined();
  });

  test("tiers agree with the rates: no premium engine is cheaper than a budget one", () => {
    const dearestBudget = Math.max(
      ...VIDEO_ENGINES.filter((e) => e.tier === "budget").map((e) => e.supplierUsdPerSecond),
    );
    const cheapestPremium = Math.min(
      ...VIDEO_ENGINES.filter((e) => e.tier === "premium").map((e) => e.supplierUsdPerSecond),
    );
    expect(cheapestPremium).toBeGreaterThan(dearestBudget);
  });
});

describe("credit packs", () => {
  test("every pack still sells credits above cost after its bonus", () => {
    for (const pack of CREDIT_PACKS) {
      expect(packMarkup(pack)).toBeGreaterThan(1.2);
    }
  });

  test("buying more is cheaper per credit", () => {
    const byPrice = [...CREDIT_PACKS].sort((a, b) => a.usd - b.usd);
    for (let i = 1; i < byPrice.length; i += 1) {
      expect(packUsdPerCredit(byPrice[i])).toBeLessThan(packUsdPerCredit(byPrice[i - 1]));
    }
  });

  test("no pack is priced above the headline rate", () => {
    for (const pack of CREDIT_PACKS) {
      expect(packUsdPerCredit(pack)).toBeLessThanOrEqual(USD_PER_CREDIT);
    }
  });

  test("exactly one pack is highlighted", () => {
    expect(CREDIT_PACKS.filter((pack) => pack.highlight)).toHaveLength(1);
  });

  test("pack ids are unique", () => {
    const ids = CREDIT_PACKS.map((pack) => pack.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("film estimates", () => {
  test("a five-scene film on the default engine is profitable", () => {
    const estimate = estimateFilm(5, 5);
    expect(estimate.credits).toBe(70);
    expect(estimate.usd).toBeCloseTo(7, 5);
    expect(estimate.usd).toBeGreaterThan(estimate.supplierUsd * 1.5);
  });

  test("the premium engine costs more than the default for the same film", () => {
    const premium = VIDEO_ENGINES.find((engine) => engine.tier === "premium");
    expect(premium).toBeDefined();
    expect(estimateFilm(5, 5, premium!).credits).toBeGreaterThan(estimateFilm(5, 5).credits);
  });

  test("an empty film costs nothing", () => {
    expect(estimateFilm(0, 5).credits).toBe(0);
  });

  test("every engine leaves a margin on a whole film", () => {
    for (const engine of VIDEO_ENGINES) {
      const estimate = estimateFilm(6, 5, engine);
      expect(estimate.usd).toBeGreaterThan(estimate.supplierUsd);
    }
  });
});

describe("the signup grant", () => {
  test("covers a real first film rather than a single image", () => {
    const oneScene = estimateFilm(1, 5);
    expect(SIGNUP_CREDIT_GRANT).toBeGreaterThan(oneScene.credits);
  });

  test("does not cover a full film, so the grant cannot be farmed", () => {
    expect(SIGNUP_CREDIT_GRANT).toBeLessThan(estimateFilm(5, 5).credits);
  });

  test("costs CineStory at most a dollar to give away", () => {
    // Caps the exposure to a wave of throwaway signups.
    expect(creditsToUsd(SIGNUP_CREDIT_GRANT) / RETAIL_MARKUP).toBeLessThanOrEqual(1);
  });
});

describe("image pricing", () => {
  test("a storyboard image is cheap enough to retry freely", () => {
    expect(imageCredits()).toBeLessThanOrEqual(3);
  });
});
