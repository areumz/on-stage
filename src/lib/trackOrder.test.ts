import { describe, it, expect } from "vitest";
import { neighborSwap } from "./trackOrder";
import type { TrackRow } from "./types";

function track(id: string, no: number): TrackRow {
  return { id, artist_id: "artist-1", no, title: `Track ${no}`, duration: "3:00", cover_from: "#000000", cover_to: "#ffffff" };
}

const tracks = [track("a", 1), track("b", 2), track("c", 3)];

describe("neighborSwap", () => {
  it("returns the previous track when moving a middle track up", () => {
    expect(neighborSwap(tracks, "b", "up")).toEqual([track("b", 2), track("a", 1)]);
  });

  it("returns the next track when moving a middle track down", () => {
    expect(neighborSwap(tracks, "b", "down")).toEqual([track("b", 2), track("c", 3)]);
  });

  // 맨 위 트랙은 더 위로 옮길 상대가 없다
  it("returns null when moving the first track up", () => {
    expect(neighborSwap(tracks, "a", "up")).toBeNull();
  });

  // 맨 아래 트랙은 더 아래로 옮길 상대가 없다
  it("returns null when moving the last track down", () => {
    expect(neighborSwap(tracks, "c", "down")).toBeNull();
  });

  it("returns null for an id that isn't in the list", () => {
    expect(neighborSwap(tracks, "z", "up")).toBeNull();
  });

  // 입력이 no 순으로 정렬돼 있지 않아도 함수 내부에서 정렬해 계산해야 한다
  it("sorts by no before computing the pair, even if the input order is shuffled", () => {
    const shuffled = [track("c", 3), track("a", 1), track("b", 2)];
    expect(neighborSwap(shuffled, "a", "down")).toEqual([track("a", 1), track("b", 2)]);
  });
});
