import { shallow } from "@liveblocks/client";
import { useCallback, useEffect, useState } from "react";
import { useOthers, useRoom, useStorage } from "../liveblocks.config";
import type { CellAddress, UserInfo } from "../types";
import { type Actions, createActions } from "./actions";

export interface ReactSpreadsheet {
  // XXX Move these data fields away
  evaluatedCells: Record<string, string>;
  othersByCell: Record<string, UserInfo>;
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

  const [actions, setSpreadsheetActions] = useState<Actions>(() =>
    createActions(room)
  );
  const [evaluatedCells, setEvaluatedCells] = useState<Record<string, string>>(
    {}
  );
  const [selection, setSelection] = useState<CellAddress | null>(null);

  const othersByCell = useOthers(
    (others) =>
      others.reduce((prev, curr) => {
        if (curr.presence.selectedCell) {
          prev[curr.presence.selectedCell] = curr.info;
        }
        return prev;
      }, {} as Record<string, UserInfo>),
    shallow
  );

  const selectCell = useCallback(
    (columnId: string, rowId: string) => {
      setSelection({ columnId, rowId });
      actions.selectCell(columnId, rowId);
    },
    [actions]
  );

  useEffect(() => {
    const spreadsheet = createActions(room);
    setSpreadsheetActions(spreadsheet);

    const unsub3 = spreadsheet.onCellsChange(setEvaluatedCells);

    return () => {
      unsub3();
    };
  }, [room]);

  useEffect(() => {
    if (!selection && columns.length > 0 && rows.length > 0) {
      selectCell(columns[0].id, rows[0].id);
    }
  }, [columns, rows, selection, selectCell]);

  return {
    // XXX Move these data fields away
    evaluatedCells,
    selection,
    othersByCell,

    // Customized actions
    selectCell: selectCell,

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
