import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const localStorageMemory = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
})();

beforeEach(() => {
  cleanup();
  vi.stubGlobal("localStorage", localStorageMemory);
  Object.defineProperty(window, "localStorage", {
    value: localStorageMemory,
    configurable: true,
  });
  localStorageMemory.clear();
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal("confirm", vi.fn(() => true));
  vi.stubGlobal("prompt", vi.fn(() => "Test workflow"));
  vi.stubGlobal("alert", vi.fn());
  Object.defineProperty(window.navigator, "clipboard", {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(""),
    },
    configurable: true,
  });
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    value: vi.fn(),
    configurable: true,
  });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});