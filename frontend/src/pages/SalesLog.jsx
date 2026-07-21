import { useEffect, useMemo, useState } from 'react'
import {
  Banknote, Download, Flag, Receipt, RotateCcw, Search, TrendingUp, X,
} from 'lucide-react'
import { api } from '../api'
import { useAuth, isLead } from '../auth'
import { fmt } from '../money'
import { ConfirmDialog } from '../components/Dialog'
import { Avatar, Badge, EmptyState, SectionHeader, StatCard, ViewToggle } from '../components/ui'

const VIEW_KEY = 'pos_saleslog_view'

// The full audit trail of a camp: every sale, who booked it, for whom, when, how
// it was paid and whether it was reversed or needs checking. Exportable as CSV,
// because the end-of-camp accounting happens in a spreadsheet.
export default function SalesLog() {
  const { user } = useAuth()
  const [sales, setSales] = useState([])
  const [search, setSearch] = useState('')
  const [day, setDay] = useState('') // '' = all days
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'list')
  const [busyId, setBusyId] = useState(null)
  const [confirm, setConfirm] = useState(null) // { sale, kind: 'flag' | 'reverse' }
  const [error, setError] = useState(null)

  async function reload() {
    try {
      setSales(await api('/api/sales'))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    reload()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function changeView(next) {
    setView(next)
    localStorage.setItem(VIEW_KEY, next)
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sales.filter((s) => {
      if (day && new Date(s.createdAt).toLocaleDateString('sv-SE') !== day) return false
      if (!q) return true
      const haystack = [
        s.participantName ?? 'barverkauf',
        s.sellerName,
        ...s.items.map((i) => i.productName),
      ].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [sales, search, day])

  const booked = visible.filter((s) => s.status === 'COMPLETED')
  const revenue = booked.reduce((sum, s) => sum + Number(s.totalAmount), 0)

  async function act() {
    const { sale, kind } = confirm
    setBusyId(sale.id)
    setError(null)
    try {
      await api(`/api/sales/${sale.id}/${kind === 'flag' ? 'flag' : 'reverse'}`, { method: 'POST' })
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  // Built here rather than on the server: the rows are already loaded, and the
  // export should match exactly what the filters are showing.
  function exportCsv() {
    const head = ['Datum', 'Uhrzeit', 'Verkäufer', 'Teilnehmer', 'Artikel', 'Summe', 'Bar', 'Guthaben', 'Schulden', 'Status']
    const rows = visible.map((s) => {
      const d = new Date(s.createdAt)
      return [
        d.toLocaleDateString('de-AT'),
        d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }),
        s.sellerName,
        s.participantName ?? 'Barverkauf',
        s.items.map((i) => `${i.quantity}x ${i.productName}`).join('; '),
        s.totalAmount, s.paidCash, s.paidFromBalance, s.debtAmount,
        s.status === 'REVERSED' ? 'storniert' : 'gebucht',
      ]
    })
    // quote every field: product names and item lists contain commas and semicolons
    const csv = [head, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `verkaeufe-${day || 'alle'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const today = new Date().toLocaleDateString('sv-SE') // sv-SE gives YYYY-MM-DD

  return (
    <div className="space-y-4">
      <SectionHeader title="Verkäufe" hint="Alle Buchungen dieses Camps">
        <button onClick={exportCsv} disabled={visible.length === 0}
                className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40">
          <Download className="w-4 h-4" /> CSV
        </button>
      </SectionHeader>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Verkäufe" value={booked.length} hint={`${visible.length - booked.length} storniert`} tone="info" icon={Receipt} />
        <StatCard label="Umsatz" value={fmt(revenue)} hint={day ? 'am gewählten Tag' : 'gesamt'} tone="success" icon={TrendingUp} />
        <StatCard label="Bar eingenommen" value={fmt(booked.reduce((s, x) => s + Number(x.paidCash), 0))} tone="primary" icon={Banknote} />
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Teilnehmer, Produkt oder Verkäufer…"
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 bg-white"
          />
        </div>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
               className="border border-gray-300 rounded-lg px-3 py-2.5 bg-white text-sm" />
        <button onClick={() => setDay(today)} className={`rounded-lg px-3 py-2.5 text-sm border ${day === today ? 'bg-primary text-white border-primary' : 'bg-white'}`}>
          Heute
        </button>
        {(day || search) && (
          <button onClick={() => { setDay(''); setSearch('') }}
                  className="rounded-lg px-3 py-2.5 text-sm border bg-white flex items-center gap-1">
            <X className="w-4 h-4" /> Filter
          </button>
        )}
        <ViewToggle view={view} onChange={changeView} />
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Receipt} hint={sales.length ? 'Andere Filter probieren.' : undefined}>
          {sales.length ? 'Keine Verkäufe für diese Filter.' : 'Noch keine Verkäufe in diesem Camp.'}
        </EmptyState>
      ) : (
        <div className={view === 'grid'
          ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'
          : 'bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden'}>
          {visible.map((s) => (
            <SaleRow
              key={s.id}
              sale={s}
              card={view === 'grid'}
              canReview={isLead(user)}
              busy={busyId === s.id}
              onFlag={() => setConfirm({ sale: s, kind: 'flag' })}
              onReverse={() => setConfirm({ sale: s, kind: 'reverse' })}
            />
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'flag' ? 'Zur Prüfung markieren' : 'Verkauf stornieren'}
          message={
            confirm.kind === 'flag'
              ? 'Der Verkauf bleibt bestehen und wird der Stand-Leitung zur Kontrolle angezeigt. Nichts wird rückgängig gemacht.'
              : `Der Verkauf über ${fmt(confirm.sale.totalAmount)} wird rückgängig gemacht und dem Teilnehmer gutgeschrieben.`
          }
          confirmLabel={confirm.kind === 'flag' ? 'Markieren' : 'Stornieren'}
          tone={confirm.kind === 'flag' ? 'primary' : 'danger'}
          onConfirm={act}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

function SaleRow({ sale, card, canReview, busy, onFlag, onReverse }) {
  const reversed = sale.status === 'REVERSED'
  const when = new Date(sale.createdAt)

  return (
    <div className={`${card ? 'bg-white rounded-xl shadow-sm' : ''} flex items-center gap-3 p-3 ${reversed ? 'opacity-60' : 'hover:bg-gray-50'}`}>
      {sale.participantName ? (
        <Avatar name={sale.participantName} size="sm" />
      ) : (
        <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
          <Banknote className="w-4 h-4" />
        </span>
      )}

      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate flex items-center gap-2 ${reversed ? 'line-through' : ''}`}>
          {sale.participantName ?? <span className="italic font-normal text-gray-500">Barverkauf</span>}
          {reversed && <Badge tone="neutral">storniert</Badge>}
          {sale.flaggedForReview && <Badge tone="warning">zu prüfen</Badge>}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {sale.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
        </div>
        <div className="text-[11px] text-gray-400">
          {when.toLocaleDateString('de-AT')} {when.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })} · {sale.sellerName}
        </div>
        {/* who raised the concern / who undid it - a flag has to be traceable */}
        {sale.flaggedForReview && sale.flaggedByName && (
          <div className="text-[11px] text-warning">
            markiert von {sale.flaggedByName}
            {sale.flaggedAt && ` · ${new Date(sale.flaggedAt).toLocaleString('de-AT')}`}
          </div>
        )}
        {reversed && sale.reversedByName && (
          <div className="text-[11px] text-accent">
            storniert von {sale.reversedByName}
            {sale.reversedAt && ` · ${new Date(sale.reversedAt).toLocaleString('de-AT')}`}
          </div>
        )}
      </div>

      <div className="text-right shrink-0">
        <div className="font-semibold">{fmt(sale.totalAmount)}</div>
        <div className="text-[11px] text-gray-400">
          {Number(sale.debtAmount) > 0 ? 'Schulden' : Number(sale.paidFromBalance) > 0 ? 'Guthaben' : 'Bar'}
        </div>
      </div>

      {/* anyone may raise a concern; only a lead should undo a booking outright */}
      <div className="flex gap-1 shrink-0">
        {!sale.flaggedForReview && !reversed && (
          <button onClick={onFlag} disabled={busy} title="Zur Prüfung markieren"
                  className="border rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40">
            <Flag className="w-4 h-4" />
          </button>
        )}
        {/* Stornieren only after the sale was raised for review - and only for leads.
            Sellers flag; the leadership decides. */}
        {canReview && !reversed && sale.flaggedForReview && (
          <button onClick={onReverse} disabled={busy} title="Stornieren (geprüft)"
                  className="border rounded-lg p-2 text-accent hover:bg-accent-soft disabled:opacity-40">
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
