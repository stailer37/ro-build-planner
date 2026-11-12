import { describe, expect, it } from "vitest";
import { MERGE_WINDOW_MS, edit, initHistory, redo, undo } from "./history.ts";

describe("history", () => {
  it("undoes and redoes edits made apart", () => {
    let h = initHistory("a");
    h = edit(h, "b", 0);
    h = edit(h, "c", MERGE_WINDOW_MS * 2);
    h = undo(h);
    expect(h.present).toBe("b");
    h = undo(h);
    expect(h.present).toBe("a");
    expect(undo(h)).toBe(h);
    h = redo(redo(h));
    expect(h.present).toBe("c");
    expect(redo(h)).toBe(h);
  });

  it("merges quick edits into one step", () => {
    let h = initHistory("");
    h = edit(h, "8", 0);
    h = edit(h, "85", MERGE_WINDOW_MS / 2);
    expect(undo(h).present).toBe("");
  });

  it("drops the redo steps on a new edit", () => {
    let h = edit(initHistory("a"), "b", 0);
    h = edit(undo(h), "c", 0);
    expect(h.future).toEqual([]);
    expect(undo(h).present).toBe("a");
  });
});
