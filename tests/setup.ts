import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:mock-preview") });
Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);
