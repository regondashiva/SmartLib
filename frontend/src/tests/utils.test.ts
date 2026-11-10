import { describe, it, expect } from "vitest";
import { formatCurrency, formatAccessionNumber, truncateText, getInitials } from "@/lib/utils";

describe("Utility functions", () => {
  it("formats currency correctly in INR", () => {
    const formatted = formatCurrency(250);
    expect(formatted).toContain("250");
  });

  it("preserves accession numbers", () => {
    expect(formatAccessionNumber("ACC-2026-0001")).toBe("ACC-2026-0001");
  });

  it("truncates long strings properly", () => {
    const long = "This is a very long book description that should be truncated";
    const truncated = truncateText(long, 20);
    expect(truncated).toBe("This is a very long …");
    expect(truncateText("Short", 10)).toBe("Short");
  });

  it("extracts user initials", () => {
    expect(getInitials("System Administrator")).toBe("SA");
    expect(getInitials("Librarian")).toBe("LI");
    expect(getInitials("Chief Technical Officer")).toBe("CT");
  });
});

