import {
  flexRender,
  type Table as TanstackTable,
} from '@tanstack/react-table'

interface TableProps<TData> {
  table: TanstackTable<TData>
  onRowClick?: (row: TData) => void
}

export default function Table<TData>({ table, onRowClick }: TableProps<TData>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  onClick={header.column.getToggleSortingHandler()}
                  style={{
                    color: 'var(--text-muted)',
                    background: 'var(--bg-surface)',
                    cursor: header.column.getCanSort() ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && ' ↑'}
                    {header.column.getIsSorted() === 'desc' && ' ↓'}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              className="transition-colors"
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                cursor: onRowClick ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => { if (onRowClick) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="px-4 py-3"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
