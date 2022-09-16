import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoom, useStorage } from "../liveblocks.config";
import type { CellAddress } from "../types";
import { type Actions, createActions } from "./actions";
import { splitCellId } from "./utils";

export interface ReactSpreadsheet {
  // XXX Move these data fields away
  evaluatedCells: Record<string, string>;
  selection: CellAddress | null;

  // Readers
  // XXX Move these readers away
  getCellExpression: Actions["getCellExpression"];
  getFormattedCellValue: Actions["getFormattedCellValue"];

  // Actions
  clearColumn: Actions["clearColumn"];
  clearRow: Actions["clearRow"];
  deleteCell: Actions["deleteCell"];
  deleteColumn: Actions["deleteColumn"];
  deleteRow: Actions["deleteRow"];
  insertColumn: Actions["insertColumn"];
  insertRow: Actions["insertRow"];
  moveColumn: Actions["moveColumn"];
  moveRow: Actions["moveRow"];
  resizeColumn: Actions["resizeColumn"];
  resizeRow: Actions["resizeRow"];
  selectCell: Actions["selectCell"];
  setCellValue: Actions["setCellValue"];
}

export function useSpreadsheet(): ReactSpreadsheet {
  const room = useRoom();

  // XXX Ideally don't subscribe to _all_ column/row updates at this level!
  const columns = useStorage((root) => root.spreadsheet.columns);
  const rows = useStorage((root) => root.spreadsheet.rows);

  // XXX Can we refactor this to useActions?
  const actions: Actions = useMemo(() => createActions(room), [room]);

  const rawCells = useStorage((root) => root.spreadsheet.cells);

  const evaluatedCells: Record<string, string> = useMemo(
    () =>
      Object.fromEntries(
        [...rawCells.keys()].map((cellId) => [
          cellId,
          actions.getFormattedCellValue(...splitCellId(cellId)),
        ])
      ),
    [rawCells]
  );

  const [selection, setSelection] = useState<CellAddress | null>(null);

  const selectCell = useCallback(
    (columnId: string, rowId: string) => {
      setSelection({ columnId, rowId });
      actions.selectCell(columnId, rowId);
    },
    [actions]
  );

  // XXX Move this side-effect to somewhere at the top of the app!
  useEffect(() => {
    if (!selection && columns.length > 0 && rows.length > 0) {
      selectCell(columns[0].id, rows[0].id);
    }
  }, [columns, rows, selection, selectCell]);

  return {
    // XXX Move these data fields away
    evaluatedCells,
    selection,

    // Customized actions
    selectCell,

    // Actions
    insertRow: actions.insertRow,
    resizeRow: actions.resizeRow,
    moveRow: actions.moveRow,
    clearRow: actions.clearRow,
    deleteRow: actions.deleteRow,
    insertColumn: actions.insertColumn,
    resizeColumn: actions.resizeColumn,
    moveColumn: actions.moveColumn,
    clearColumn: actions.clearColumn,
    deleteColumn: actions.deleteColumn,
    getCellExpression: actions.getCellExpression,
    getFormattedCellValue: actions.getFormattedCellValue,
    setCellValue: actions.setCellValue,
    deleteCell: actions.deleteCell,
  };
}
