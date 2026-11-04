import React from 'react'
import { cn } from '../../lib/utils'

export interface TableColumn<T = unknown> {
  key: string
  header: string
  cell?: (value: unknown, row: T) => React.ReactNode
  className?: string
}

interface TableProps<T extends Record<string, unknown> = Record<string, unknown>> {
  columns: TableColumn<T>[]
  data: T[]
  className?: string
  size?: 'sm' | 'md' | 'lg'
  dir?: 'ltr' | 'rtl'
  caption?: string
  'aria-label'?: string
}

const sizePadding: Record<string, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3',
  lg: 'px-5 py-4 text-base',
}

export const Table: React.FC<TableProps> = ({
  columns,
  data,
  className,
  size = 'md',
  dir,
  caption,
  'aria-label': scrollAriaLabel,
  ...props
}) => {
  const cellPadding = sizePadding[size]

  return (
    <div
      className="overflow-x-auto w-full"
      dir={dir || undefined}
      aria-label={scrollAriaLabel || undefined}
    >
      <table className={cn('table', className)} {...props}>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(cellPadding, column.className)}
                scope="col"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${rowIndex}`}>
              {columns.map((column) => {
                const value = row[column.key]
                return (
                  <td
                    key={column.key}
                    className={cn(cellPadding, column.className)}
                  >
                    {column.cell ? column.cell(value, row) : String(value ?? '')}
                  </td>
                )
              })}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className={cn(cellPadding, 'text-center text-ink-3')}
              >
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

Table.displayName = 'Table'
