import { describe, expect, it } from "vitest";
import type { StoredDataset } from "@/lib/data/datasets.functions";
import { withFilteredRows } from "./datasets";

const dataset: StoredDataset = {
  id: "dataset-1",
  owner_id: "owner-1",
  name: "tickets.csv",
  kind: "csv",
  rows: 3,
  columns: ["ticket", "status", "requester"],
  sizeBytes: 128,
  createdAt: 0,
  truncated: false,
  source: "upload",
  preview: [
    { ticket: "T-1", status: "open", requester: "error@example.com" },
    { ticket: "T-2", status: "error", requester: "ada@example.com" },
    { ticket: "T-3", status: "closed", requester: "grace@example.com" },
  ],
};

describe("dataset preview filtering", () => {
  it("limits visible and exported rows to matches in the selected column", () => {
    const result = withFilteredRows(dataset, "error", false, "status");

    expect(result.preview).toEqual([
      { ticket: "T-2", status: "error", requester: "ada@example.com" },
    ]);
  });

  it("still searches every column when the scope is all columns", () => {
    const result = withFilteredRows(dataset, "error", false, "all");

    expect(result.preview.map((row) => row.ticket)).toEqual(["T-1", "T-2"]);
  });

  it("applies case sensitivity within the selected column", () => {
    expect(withFilteredRows(dataset, "ERROR", true, "status").preview).toEqual([]);
    expect(withFilteredRows(dataset, "error", true, "status").preview.map((row) => row.ticket)).toEqual(["T-2"]);
  });
});
