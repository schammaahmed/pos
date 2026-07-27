import { useEffect, useMemo, useState } from 'react'
import {
  Banknote, Download, Flag, PackageOpen, Receipt, RotateCcw, Search, Tent, TrendingUp, X,
} from 'lucide-react'
import { api } from '../api'
import { useAuth, isLead } from '../auth'
import { fmt } from '../money'
import { ConfirmDialog } from '../components/Dialog'
import { Avatar, Badge, EmptyState, SectionHeader, StatCard, ViewToggle } from '../components/ui'

const VIEW_KEY = 'pos_saleslog_view'

// The camp's full money ledger: every transaction across all three streams - over-the-counter
// sales, collected Aktionen, and picked-up Vorbestellungen - who booked it, for whom, when,
// how it was paid, whether it was reversed or needs checking. Fed by GET /api/ledger.
// Exportable as CSV, because end-of-camp accounting happens in a spreadsheet.
export default function SalesLog() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [search, setSearch] = useState('')
  const [day, setDay] = useState('') // '' = all days
  const [kindFilter, setKindFilter] = useState('all') // all | SALE | SPECIAL | PREORDER
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'list')
  const [busyId, setBusyId] = useState(null)
  const [confirm, setConfirm] = useState(null) // { entry, kind: 'flag' | 'reverse' }
  const [error, setError] = useState(null)

  async function reload() {
    try {
      setEntries(await api('/api/ledger'))
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
    return entries.filter((e) => {
      if (kindFilter !== 'all' && e.kind !== kindFilter) return false
      // e.timestamp can be null on a half-migrated row; such rows only survive the "all days" view
      if (day) {
        if (!e.timestamp) return false
        if (new Date(e.timestamp).toLocaleDateString('sv-SE') !== day) return false
      }
      if (!q) return true
      const haystack = [e.participantName ?? 'barverkauf', e.staffName, e.description]
        .join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [entries, search, day, kindFilter])

  // "reversed" only applies to sales; specials/preorders are always actual money in
  const isRevenue = (e) => e.status !== 'REVERSED'
  const booked = visible.filter(isRevenue)
  const revenue = booked.reduce((sum, e) => sum + Number(e.totalAmount), 0)
  const reversedCount = visible.length - booked.length

  async function act() {
    const { entry, kind } = confirm
    setBusyId(entry.id)
    setError(null)
    try {
      await api(`/api/sales/${entry.id}/${kind === 'flag' ? 'flag' : 'reverse'}`, { method: 'POST' })
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
      setConfirm(null)
    }
  }

  // Built here rather than on the server: the rows are already loaded, and the export
  // should match exactly what the filters are showing.
  function exportCsv() {
    const head = ['Art', 'Datum', 'Uhrzeit', 'Wer', 'Teilnehmer', 'Beschreibung', 'Summe', 'Bar', 'Guthaben', 'Schulden', 'Status']
    const rows = visible.map((e) => {
      const d = e.timestamp ? new Date(e.timestamp) : null
      return [
        KIND_LABEL[e.kind],
        d ? d.toLocaleDateString('de-AT') : '',
        d ? d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) : '',
        e.staffName ?? '',
        e.participantName ?? 'Barverkauf',
        e.description,
        e.totalAmount, e.paidCash, e.paidFromBalance, e.debtAmount,
        e.status === 'REVERSED' ? 'storniert' : 'gebucht',
      ]
    })
    // quote every field: descriptions contain commas and semicolons
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
      <SectionHeader title="Verkäufe" hint="Alle Buchungen dieses Camps – Kasse, Aktionen & Vorbestellungen">
        <button onClick={exportCsv} disabled={visible.length === 0}
                className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40">
          <Download className="w-4 h-4" /> CSV
        </button>
      </SectionHeader>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Buchungen" value={booked.length} hint={`${reversedCount} storniert`} tone="info" icon={Receipt} />
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
        {(day || search || kindFilter !== 'all') && (
          <button onClick={() => { setDay(''); setSearch(''); setKindFilter('all') }}
                  className="rounded-lg px-3 py-2.5 text-sm border bg-white flex items-center gap-1">
            <X className="w-4 h-4" /> Filter
          </button>
        )}
        <ViewToggle view={view} onChange={changeView} />
      </div>

      {/* kind filter chips - "list everything" but also let a lead isolate one stream */}
      <div className="flex flex-wrap gap-1.5">
        {[['all', 'Alle'], ['SALE', 'Kasse'], ['SPECIAL', 'Aktionen'], ['PREORDER', 'Vorbestellungen']].map(([k, label]) => (
          <button key={k} onClick={() => setKindFilter(k)}
                  className={`text-xs font-semibold rounded-full px-3 py-1 border ${
                    kindFilter === k ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}>
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Receipt} hint={entries.length ? 'Andere Filter probieren.' : undefined}>
          {entries.length ? 'Keine Buchungen für diese Filter.' : 'Noch keine Buchungen in diesem Camp.'}
        </EmptyState>
      ) : (
        <div className={view === 'grid'
          ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'
          : 'bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden'}>
          {visible.map((e) => (
            <LedgerRow
              key={`${e.kind}-${e.id}`}
              entry={e}
              card={view === 'grid'}
              canReview={isLead(user)}
              busy={busyId === e.id}
              onFlag={() => setConfirm({ entry: e, kind: 'flag' })}
              onReverse={() => setConfirm({ entry: e, kind: 'reverse' })}
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
              : `Der Verkauf über ${fmt(confirm.entry.totalAmount)} wird rückgängig gemacht und dem Teilnehmer gutgeschrieben.`
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

const KIND_LABEL = { SALE: 'Kasse', SPECIAL: 'Aktion', PREORDER: 'Vorbestellung' }
const KIND_TONE = { SALE: 'neutral', SPECIAL: 'info', PREORDER: 'primary' }
const KIND_ICON = { SALE: Receipt, SPECIAL: Tent, PREORDER: PackageOpen }

function LedgerRow({ entry, card, canReview, busy, onFlag, onReverse }) {
  const reversed = entry.status === 'REVERSED'
  const when = entry.timestamp ? new Date(entry.timestamp) : null
  const KindIcon = KIND_ICON[entry.kind]
  // flag/reverse actions only make sense on a sale row (the other kinds aren't reversed here)
  const isSale = entry.kind === 'SALE'

  return (
    <div className={`${card ? 'bg-white rounded-xl shadow-sm' : ''} flex items-center gap-3 p-3 ${reversed ? 'opacity-60' : 'hover:bg-gray-50'}`}>
      {entry.participantName ? (
        <Avatar name={entry.participantName} size="sm" />
      ) : (
        <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
          <Banknote className="w-4 h-4" />
        </span>
      )}

      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate flex items-center gap-2 ${reversed ? 'line-through' : ''}`}>
          {entry.participantName ?? <span className="italic font-normal text-gray-500">Barverkauf</span>}
          <span className="inline-flex items-center gap-1"><Badge tone={KIND_TONE[entry.kind]}>
            <KindIcon className="w-3 h-3 inline -mt-0.5 mr-0.5" />{KIND_LABEL[entry.kind]}
          </Badge></span>
          {reversed && <Badge tone="neutral">storniert</Badge>}
          {entry.flaggedForReview && <Badge tone="warning">zu prüfen</Badge>}
        </div>
        <div className="text-xs text-gray-500 truncate">{entry.description}</div>
        <div className="text-[11px] text-gray-400">
          {when
            ? `${when.toLocaleDateString('de-AT')} ${when.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`
            : 'ohne Zeitstempel'} · {entry.staffName ?? '—'}
        </div>
        {entry.flaggedForReview && entry.flaggedByName && (
          <div className="text-[11px] text-warning">
            markiert von {entry.flaggedByName}
            {entry.flaggedAt && ` · ${new Date(entry.flaggedAt).toLocaleString('de-AT')}`}
          </div>
        )}
        {reversed && entry.reversedByName && (
          <div className="text-[11px] text-accent">
            storniert von {entry.reversedByName}
            {entry.reversedAt && ` · ${new Date(entry.reversedAt).toLocaleString('de-AT')}`}
          </div>
        )}
      </div>

      <div className="text-right shrink-0">
        <div className="font-semibold">{fmt(entry.totalAmount)}</div>
        <div className="text-[11px] text-gray-400">
          {Number(entry.debtAmount) > 0 ? 'Schulden' : Number(entry.paidFromBalance) > 0 ? 'Guthaben' : 'Bar'}
        </div>
      </div>

      {/* actions apply to sales only: anyone may raise a concern, only a lead undoes after review */}
      <div className="flex gap-1 shrink-0">
        {isSale && !entry.flaggedForReview && !reversed && (
          <button onClick={onFlag} disabled={busy} title="Zur Prüfung markieren"
                  className="border rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40">
            <Flag className="w-4 h-4" />
          </button>
        )}
        {isSale && canReview && !reversed && entry.flaggedForReview && (
          <button onClick={onReverse} disabled={busy} title="Stornieren (geprüft)"
                  className="border rounded-lg p-2 text-accent hover:bg-accent-soft disabled:opacity-40">
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
