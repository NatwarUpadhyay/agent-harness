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

  it("keeps matching anywhere in the value by default", () => {
    expect(withFilteredRows(dataset, "open", false, "all", "contains").preview.map((row) => row.ticket)).toEqual(["T-1"]);
    expect(withFilteredRows(dataset, "pen", false, "all", "contains").preview.map((row) => row.ticket)).toEqual(["T-1"]);
  });

  it("keeps only values beginning with the filter text in starts-with mode", () => {
    expect(withFilteredRows(dataset, "open", false, "all", "starts").preview.map((row) => row.ticket)).toEqual(["T-1"]);
    expect(withFilteredRows(dataset, "pen", false, "all", "starts").preview).toEqual([]);
  });

  it("keeps only identical values in exact-match mode", () => {
    expect(withFilteredRows(dataset, "open", false, "all", "exact").preview.map((row) => row.ticket)).toEqual(["T-1"]);
    expect(withFilteredRows(dataset, "open", false, "status", "exact").preview.map((row) => row.ticket)).toEqual(["T-1"]);
    expect(withFilteredRows(dataset, "error@example.com", false, "all", "exact").preview.map((row) => row.ticket)).toEqual(["T-1"]);
    expect(withFilteredRows(dataset, "error", false, "status", "exact").preview.map((row) => row.ticket)).toEqual(["T-2"]);
    expect(withFilteredRows(dataset, "erro", false, "status", "exact").preview).toEqual([]);
  });

  it("combines the match mode with case sensitivity", () => {
    expect(withFilteredRows(dataset, "OPEN", false, "status", "starts").preview.map((row) => row.ticket)).toEqual(["T-1"]);
    expect(withFilteredRows(dataset, "OPEN", true, "status", "starts").preview).toEqual([]);
    expect(withFilteredRows(dataset, "OPEN", true, "status", "exact").preview).toEqual([]);
  });

  it("matches only suffixes in ends-with mode", () => {
    expect(withFilteredRows(dataset, "pen", false, "status", "ends").preview.map((row) => row.ticket)).toEqual(["T-1"]);
    expect(withFilteredRows(dataset, "ope", false, "status", "ends").preview).toEqual([]);
  });

  it("respects the column scope for suffix matches in visible and exported rows", () => {
    expect(withFilteredRows(dataset, "com", false, "requester", "ends").preview.map((row) => row.ticket)).toEqual(["T-1", "T-2", "T-3"]);
    expect(withFilteredRows(dataset, "com", false, "status", "ends").preview).toEqual([]);
  });

  it("respects case sensitivity for suffix matches", () => {
    expect(withFilteredRows(dataset, "PEN", false, "status", "ends").preview.map((row) => row.ticket)).toEqual(["T-1"]);
    expect(withFilteredRows(dataset, "PEN", true, "status", "ends").preview).toEqual([]);
  });

  it("hides every row containing the text in doesn't-contain mode", () => {
    expect(withFilteredRows(dataset, "error", false, "all", "excludes").preview.map((row) => row.ticket)).toEqual(["T-3"]);
    expect(withFilteredRows(dataset, "error", false, "status", "excludes").preview.map((row) => row.ticket)).toEqual(["T-1", "T-3"]);
    expect(withFilteredRows(dataset, "ERROR", true, "all", "excludes").preview).toHaveLength(3);
  });
});
