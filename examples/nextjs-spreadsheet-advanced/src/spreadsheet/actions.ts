import { LiveObject, type Room } from "@liveblocks/client";
import { nanoid } from "nanoid";
import { ID_LENGTH } from "../constants";
import type { Presence, Storage, UserMeta } from "../types";
import interpreter from "./interpreter";
import type { ExpressionResult } from "./interpreter";
import tokenizer, {
  type CellToken,
  type RefToken,
  SyntaxKind,
  tokenToString,
} from "./interpreter/tokenizer";
import {
  convertLetterToNumber,
  formatExpressionResult,
  getHeaderLabel,
} from "./interpreter/utils";
import { splitCellId, toCellId, removeFromArray } from "./utils";

export interface Actions {
  // Readers
  // XXX Move these readers away
  getCellExpression(columnId: string, rowId: string): string;
  getFormattedCellValue(columnId: string, rowId: string): string;

  // Callbacks
  // XXX Refactor these callbacks away
  onCellsChange(callback: (cells: Record<string, string>) => void): () => void;

  // Writers
  clearColumn(index: number): void;
  clearRow(index: number): void;
  deleteCell(columnId: string, rowId: string): void;
  deleteColumn(index: number): void;
  deleteRow(index: number): void;
  insertColumn(index: number, width: number): void;
  insertRow(index: number, width: number): void;
  moveColumn(from: number, to: number): void;
  moveRow(from: number, to: number): void;
  resizeColumn(index: number, width: number): void;
  resizeRow(index: number, height: number): void;
  selectCell(columnId: string, rowId: string): void;
  setCellValue(columnId: string, rowId: string, value: string): void;
}

export function createActions(
  room: Room<Presence, Storage, UserMeta, never>
): Actions {
  const root = room.getStorageSnapshot();
  if (root == null) {
    throw new Error("Should not happen!");
  }

  const spreadsheet = root.get("spreadsheet");

  function insertColumn(index: number, width: number) {
    spreadsheet
      .get("columns")
      .insert(new LiveObject({ id: nanoid(ID_LENGTH), width }), index);
  }

  function insertRow(index: number, height: number) {
    spreadsheet
      .get("rows")
      .insert(new LiveObject({ id: nanoid(ID_LENGTH), height }), index);
  }

  function resizeColumn(index: number, width: number) {
    spreadsheet.get("columns").get(index)?.set("width", width);
  }

  function resizeRow(index: number, height: number) {
    spreadsheet.get("rows").get(index)?.set("height", height);
  }

  function moveRow(from: number, to: number) {
    spreadsheet.get("rows").move(from, to);
  }

  function moveColumn(from: number, to: number) {
    spreadsheet.get("columns").move(from, to);
  }

  // Necessary because Liveblocks does not support nested batching yet
  function innerClearColumn(index: number) {
    const column = spreadsheet.get("columns").get(index);

    for (const row of spreadsheet.get("rows").toArray()) {
      spreadsheet
        .get("cells")
        .delete(toCellId(column!.get("id"), row.get("id")));
    }
  }

  // Necessary because Liveblocks does not support nested batching yet
  function innerClearRow(index: number) {
    const row = spreadsheet.get("rows").get(index);

    for (const column of spreadsheet.get("columns").toArray()) {
      spreadsheet
        .get("cells")
        .delete(toCellId(column.get("id"), row!.get("id")));
    }
  }

  function clearColumn(index: number) {
    room.batch(() => {
      innerClearColumn(index);
    });
  }

  function clearRow(index: number) {
    room.batch(() => {
      innerClearRow(index);
    });
  }

  function deleteColumn(index: number) {
    room.batch(() => {
      innerClearColumn(index);
      spreadsheet.get("columns").delete(index);
    });
  }

  function deleteRow(index: number) {
    room.batch(() => {
      innerClearRow(index);
      spreadsheet.get("rows").delete(index);
    });
  }

  function cellToRef(token: CellToken): RefToken {
    const [letter, number] = token.cell;

    const columnIndex = convertLetterToNumber(letter);
    const rowIndex = Number.parseInt(number) - 1;

    const column = spreadsheet.get("columns").get(columnIndex)?.get("id")!;
    const row = spreadsheet.get("rows").get(rowIndex)?.get("id")!;

    return { kind: SyntaxKind.RefToken, ref: toCellId(column, row) };
  }

  function refToCell(token: RefToken): CellToken {
    const [columnId, rowId] = splitCellId(token.ref);

    const columnIndex = spreadsheet
      .get("columns")
      .findIndex((column) => column.get("id") === columnId);
    const rowIndex = spreadsheet
      .get("rows")
      .findIndex((row) => row.get("id") === rowId);

    if (columnIndex === -1) {
      throw new Error(`Unknown row id: ${columnId}`);
    }

    if (rowIndex === -1) {
      throw new Error(`Unknown row id: ${rowId}`);
    }

    const column = getHeaderLabel(columnIndex, "column");
    const row = getHeaderLabel(rowIndex, "row");

    return {
      kind: SyntaxKind.CellToken,
      cell: `${column}${row}`,
    };
  }

  function deleteCell(columnId: string, rowId: string) {
    spreadsheet.get("cells").delete(toCellId(columnId, rowId));
  }

  function setCellValue(columnId: string, rowId: string, value: string) {
    let expression: string;

    try {
      const tokens = tokenizer(value);
      const tokensWithRefs = tokens.map((token) =>
        token.kind === SyntaxKind.CellToken
          ? cellToRef(token as CellToken)
          : token
      );

      expression = tokensWithRefs.map(tokenToString).join("");
    } catch {
      expression = value;
    }

    const cells = spreadsheet.get("cells");

    const cellId = toCellId(columnId, rowId);
    const cell = cells.get(cellId);

    if (cell == null) {
      cells.set(cellId, new LiveObject({ value: expression }));
    } else {
      cell.set("value", expression);
    }
  }

  function selectCell(columnId: string, rowId: string) {
    room.updatePresence({
      selectedCell: columnId && rowId ? toCellId(columnId, rowId) : null,
    });
  }

  function evaluateCellRef(ref: string): number {
    const [columnId, rowId] = splitCellId(ref);
    const result = evaluateCell(columnId, rowId);
    if (result.type !== "number") {
      throw new Error(
        `Expected an expression result of type number but got ${JSON.stringify(
          result
        )}`
      );
    }
    return result.value;
  }

  function evaluateCell(columnId: string, rowId: string): ExpressionResult {
    const cell = spreadsheet.get("cells").get(toCellId(columnId, rowId));
    return interpreter(cell?.get("value") ?? "", evaluateCellRef);
  }

  function getFormattedCellValue(cellId: string): string {
    const [columnId, rowId] = splitCellId(cellId);
    const result = evaluateCell(columnId, rowId);
    return formatExpressionResult(result);
  }

  function getCellExpression(columnId: string, rowId: string): string {
    const cell = spreadsheet.get("cells").get(toCellId(columnId, rowId));
    if (cell == null) {
      return "";
    }

    try {
      const tokens = tokenizer(cell.get("value"));
      const tokensWithRefs = tokens.map((token) =>
        token.kind === SyntaxKind.RefToken
          ? refToCell(token as RefToken)
          : token
      );

      return tokensWithRefs.map(tokenToString).join("");
    } catch {
      return cell.get("value");
    }
  }

  const cellCallbacks: Array<(cells: Record<string, string>) => void> = [];
  function onCellsChange(callback: (cells: Record<string, string>) => void) {
    cellCallbacks.push(callback);
    const cells = Object.fromEntries(
      [...spreadsheet.get("cells").keys()].map((cellId) => [
        cellId,
        getFormattedCellValue(cellId),
      ])
    );
    callback(cells);
    return () => removeFromArray(cellCallbacks, callback);
  }

  room.subscribe(
    spreadsheet.get("cells"),
    () => {
      const cells = Object.fromEntries(
        [...spreadsheet.get("cells").keys()].map((cellId) => [
          cellId,
          getFormattedCellValue(cellId),
        ])
      );
      for (const callback of cellCallbacks) {
        callback(cells);
      }
    },
    { isDeep: true }
  );

  return {
    insertColumn,
    insertRow,
    resizeColumn,
    resizeRow,
    moveRow,
    moveColumn,
    clearRow,
    clearColumn,
    deleteRow,
    deleteColumn,
    setCellValue,
    deleteCell,
    selectCell,
    getFormattedCellValue,
    getCellExpression,
    onCellsChange,
  };
}
