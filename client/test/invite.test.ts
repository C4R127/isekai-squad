import { describe, expect, it } from "vitest";
import { buildInviteUrl, readRoomId } from "../src/invite";

describe("readRoomId", () => {
  it("lee el id de la sala", () => expect(readRoomId("?sala=AbC123xyz")).toBe("AbC123xyz"));
  it("lo encuentra entre otros parámetros", () => expect(readRoomId("?a=1&sala=r-1_A&b=2")).toBe("r-1_A"));
  it.each(["", "?sala=", "?otra=1", "?sala=%20%20", "?sala=<script>", "?sala=" + "a".repeat(200)])(
    "devuelve null para %j",
    (s) => expect(readRoomId(s)).toBeNull(),
  );
});

describe("buildInviteUrl", () => {
  it("construye el link conservando la ruta y quitando lo demás", () =>
    expect(buildInviteUrl("https://x.github.io/isekai-squad/?sala=vieja&z=1#h", "NUEVA")).toBe(
      "https://x.github.io/isekai-squad/?sala=NUEVA",
    ));
  it("ida y vuelta", () =>
    expect(readRoomId(new URL(buildInviteUrl("http://localhost:5173/", "r-1_A")).search)).toBe("r-1_A"));
});
