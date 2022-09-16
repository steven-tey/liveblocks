import { shallow } from "@liveblocks/client";
import { useCallback, useEffect, useState } from "react";
import { useOthers, useRoom, useStorage } from "../liveblocks.config";
import type { CellAddress, Column, Row, UserInfo } from "../types";
import { type Actions, createActions } from "./actions";

export interface ReactSpreadsheet {
  // XXX Move these data fields away
  cells: Record<string, string>;
  othersByCell: Record<string, UserInfo>;
  selection: CellAddress | null;

  // Readers
  // XXX Move these readers away
  getCellExpression: Actions["getCellExpression"];
  getCellValue: Actions["getCellValue"];

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

  // XXX Remove this when done refactoring
  useStorage(() => null); // Trigger suspense if not yet loaded

  const [actions, setSpreadsheetActions] = useState<Actions>(() =>
    createActions(room)
  );
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [cells, setCells] = useState<Record<string, string>>({});
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

    const unsub1 = spreadsheet.onColumnsChange(setColumns);
    const unsub2 = spreadsheet.onRowsChange(setRows);
    const unsub3 = spreadsheet.onCellsChange(setCells);

    return () => {
      unsub1();
      unsub2();
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
    cells,
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
    getCellValue: actions.getCellValue,
    setCellValue: actions.setCellValue,
    deleteCell: actions.deleteCell,
  };
}
