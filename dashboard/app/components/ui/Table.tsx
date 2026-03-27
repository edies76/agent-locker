'use client'

import { TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes, HTMLAttributes } from 'react'

// Table wrapper
interface TableProps extends TableHTMLAttributes<HTMLTableElement> {}

export function Table({ children, className = '', ...props }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`table ${className}`} {...props}>
        {children}
      </table>
    </div>
  )
}

// Table Header
interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {}

export function TableHeader({ children, className = '', ...props }: TableHeaderProps) {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  )
}

// Table Body
interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}

export function TableBody({ children, className = '', ...props }: TableBodyProps) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  )
}

// Table Row
interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean
}

export function TableRow({ children, selected, className = '', ...props }: TableRowProps) {
  return (
    <tr 
      className={`${selected ? 'bg-accent-muted' : ''} ${className}`}
      style={selected ? { background: 'var(--accent-muted)' } : undefined}
      {...props}
    >
      {children}
    </tr>
  )
}

// Table Head Cell
interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {}

export function TableHead({ children, className = '', ...props }: TableHeadProps) {
  return (
    <th className={className} {...props}>
      {children}
    </th>
  )
}

// Table Cell
interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {}

export function TableCell({ children, className = '', ...props }: TableCellProps) {
  return (
    <td className={className} {...props}>
      {children}
    </td>
  )
}

// Empty State
interface TableEmptyProps {
  message?: string
  colSpan: number
}

export function TableEmpty({ message = 'No data available', colSpan }: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-12">
        <p className="text-muted">{message}</p>
      </td>
    </tr>
  )
}
