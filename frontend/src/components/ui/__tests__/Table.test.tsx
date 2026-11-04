/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from 'vitest'
import { render, within } from '@testing-library/react'
import { Table } from '../Table'

const columns = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
]

const data = [{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }]

describe('Table (accessibility)', () => {
  it('renders a caption for accessible table naming when provided', () => {
    const { container } = render(
      <Table columns={columns} data={data} caption="Invoice summary" />,
    )
    const caption = within(container).getByText('Invoice summary')
    expect(caption).toBeTruthy()
  })

  it('associates caption with the table element', () => {
    const { container } = render(
      <Table columns={columns} data={data} caption="Invoice summary" />,
    )
    const table = within(container).getByRole('table')
    const caption = within(container).getByText('Invoice summary')
    expect(table.contains(caption)).toBe(true)
  })

  it('does not render caption when not provided', () => {
    const { container } = render(<Table columns={columns} data={data} />)
    expect(
      within(container).queryByText('Invoice summary'),
    ).not.toBeTruthy()
  })

  it('passes aria-label to the scroll container', () => {
    const { container } = render(
      <Table
        columns={columns}
        data={data}
        aria-label="Invoices scroll region"
      />,
    )
    const scrollContainer = within(container).getByText('Item 1')
      .closest('div')
    expect(scrollContainer).toHaveAttribute(
      'aria-label',
      'Invoices scroll region',
    )
  })

  it('supports rtl direction', () => {
    const { container } = render(
      <Table columns={columns} data={data} dir="rtl" />,
    )
    const scrollContainer = within(container).getByText('Item 1')
      .closest('div')
    expect(scrollContainer).toHaveAttribute('dir', 'rtl')
  })

  it('supports ltr direction', () => {
    const { container } = render(
      <Table columns={columns} data={data} dir="ltr" />,
    )
    const scrollContainer = within(container).getByText('Item 1')
      .closest('div')
    expect(scrollContainer).toHaveAttribute('dir', 'ltr')
  })

  it('has th elements with scope=col', () => {
    const { container } = render(<Table columns={columns} data={data} />)
    expect(
      within(container).getByRole('columnheader', { name: 'ID' }),
    ).toHaveAttribute('scope', 'col')
    expect(
      within(container).getByRole('columnheader', { name: 'Name' }),
    ).toHaveAttribute('scope', 'col')
  })

  it('renders empty state when no data', () => {
    const { container } = render(<Table columns={columns} data={[]} />)
    expect(within(container).getByText('No records found.')).toBeTruthy()
  })
})
