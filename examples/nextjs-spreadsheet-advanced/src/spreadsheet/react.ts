import type { User } from "@liveblocks/client";
import { useCallback, useEffect, useState } from "react";
import { useOthers, useRoom, useStorage } from "../liveblocks.config";
import type {
  CellAddress,
  Column,
  Presence,
  Row,
  UserInfo,
  UserMeta,
} from "../types";
import { type Spreadsheet, createSpreadsheet } from ".";

export interface ReactSpreadsheet {
  cells: Record<string, string>;
  clearColumn: Spreadsheet["clearColumn"];
  clearRow: Spreadsheet["clearRow"];
  columns: Column[];
  deleteCell: Spreadsheet["deleteCell"];
  deleteColumn: Spreadsheet["deleteColumn"];
  deleteRow: Spreadsheet["deleteRow"];
  getCellExpression: Spreadsheet["getCellExpression"];
  getCellValue: Spreadsheet["getCellValue"];
  insertColumn: Spreadsheet["insertColumn"];
  insertRow: Spreadsheet["insertRow"];
  moveColumn: Spreadsheet["moveColumn"];
  moveRow: Spreadsheet["moveRow"];
  othersByCell: Record<string, UserInfo>;
  resizeColumn: Spreadsheet["resizeColumn"];
  resizeRow: Spreadsheet["resizeRow"];
  rows: Row[];
  selectCell: Spreadsheet["selectCell"];
  selection: CellAddress | null;
  setCellValue: Spreadsheet["setCellValue"];
  users: User<Presence, UserMeta>[];
}

export function useSpreadsheet(): ReactSpreadsheet {
  const room = useRoom();

  // XXX Remove this when done refactoring
  useStorage(() => null); // Trigger suspense if not yet loaded

  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet>(() =>
    createSpreadsheet(room)
  );
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [cells, setCells] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<User<Presence, UserMeta>[]>([]);
  const [selection, setSelection] = useState<CellAddress | null>(null);
  const [othersByCell, setOthersByCell] = useState<Record<string, UserInfo>>(
    {}
  );

  const selectCell = useCallback(
    (columnId: string, rowId: string) => {
      setSelection({ columnId, rowId });
      spreadsheet?.selectCell(columnId, rowId);
    },
    [spreadsheet]
  );

  useEffect(() => {
    const spreadsheet = createSpreadsheet(room);
    setSpreadsheet(spreadsheet);

    const unsub1 = spreadsheet.onColumnsChange(setColumns);
    const unsub2 = spreadsheet.onRowsChange(setRows);
    const unsub3 = spreadsheet.onCellsChange(setCells);
    const unsub4 = spreadsheet.onOthersChange((others) => {
      setUsers(others);
      setOthersByCell(
        others.reduce((prev, curr) => {
          if (curr.presence.selectedCell) {
            prev[curr.presence.selectedCell] = curr.info;
          }
          return prev;
        }, {} as Record<string, UserInfo>)
      );
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [room]);

  useEffect(() => {
    if (!selection && columns.length > 0 && rows.length > 0) {
      selectCell(columns[0].id, rows[0].id);
    }
  }, [columns, rows, selection, selectCell]);

  return {
    insertRow: spreadsheet.insertRow,
    resizeRow: spreadsheet.resizeRow,
    moveRow: spreadsheet.moveRow,
    clearRow: spreadsheet.clearRow,
    deleteRow: spreadsheet.deleteRow,
    insertColumn: spreadsheet.insertColumn,
    resizeColumn: spreadsheet.resizeColumn,
    moveColumn: spreadsheet.moveColumn,
    clearColumn: spreadsheet.clearColumn,
    deleteColumn: spreadsheet.deleteColumn,
    getCellExpression: spreadsheet.getCellExpression,
    getCellValue: spreadsheet.getCellValue,
    setCellValue: spreadsheet.setCellValue,
    deleteCell: spreadsheet.deleteCell,
    selectCell: selectCell,
    rows,
    columns,
    cells,
    users,
    selection,
    othersByCell,
  };
}
