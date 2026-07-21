import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, CopyMinus, Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import { loadUser } from '../api'
import { fmt } from '../money'
import { Badge } from './ui'

// Upload -> preview -> confirm. The preview step exists so a wrong column or a
// typo'd price is caught before 60 rows land in the database.
const KINDS = {
  participants: {
    title: 'Teilnehmer importieren',
    endpoint: 'participants',
    columns: 'Vorname, Nachname, Geschlecht (M/W), Telefon, Guthaben',
    template: 'Vorname,Nachname,Geschlecht,Telefon,Guthaben\nAnna,Beispiel,W,+43660123456,10\nBen,Muster,M,,0\n',
    templateName: 'teilnehmer-vorlage.csv',
    label: (r) => `${r.firstName} ${r.lastName}`,
    detail: (r) => [r.gender, r.phone, r.initialBalance != null ? fmt(r.initialBalance) : null]
      .filter(Boolean).join(' · '),
  },
  products: {
    title: 'Produkte importieren',
    endpoint: 'products',
    columns: 'Name, Preis, Kategorie, Bild-URL',
    template: 'Name,Preis,Kategorie,Bild-URL\nCola,1.50,Getränke,\nBueno,1.00,Süßes,\n',
    templateName: 'produkte-vorlage.csv',
    label: (r) => r.name,
    detail: (r) => [r.price != null ? fmt(r.price) : null, r.category].filter(Boolean).join(' · '),
  },
}

export default function ImportDialog({ kind, onClose, onImported }) {
  const cfg = KINDS[kind]
  const fileRef = useRef(null)
  const [fileName, setFileName] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // multipart upload: the shared api() helper always sends JSON, so this one
  // posts directly and attaches the token itself
  async function upload(file) {
    setBusy(true)
    setError(null)
    setPreview(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`/api/import/${cfg.endpoint}/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${loadUser()?.token}` },
        body,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Datei konnte nicht gelesen werden')
      setPreview(data)
      setFileName(file.name)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function commit() {
    setBusy(true)
    setError(null)
    try {
      // only the rows marked OK are sent; the server checks them again anyway
      const rows = preview.rows.filter((r) => r.status === 'OK')
      const res = await fetch(`/api/import/${cfg.endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${loadUser()?.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Import fehlgeschlagen')
      setResult(data)
      onImported()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob(['﻿' + cfg.template], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = cfg.templateName
    a.click()
    URL.revokeObjectURL(url)
  }

  const tone = { OK: 'success', DUPLICATE: 'warning', ERROR: 'accent' }
  const statusText = { OK: 'wird angelegt', DUPLICATE: 'übersprungen', ERROR: 'Fehler' }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold">{cfg.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" title="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

          {/* done */}
          {result ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-2" />
              <div className="font-semibold">{result.created} angelegt</div>
              {result.skipped > 0 && (
                <div className="text-sm text-gray-500">{result.skipped} übersprungen (schon vorhanden)</div>
              )}
            </div>
          ) : !preview ? (
            /* pick a file */
            <>
              <div className="bg-primary-soft text-primary-dark text-sm rounded-lg p-3">
                Erwartete Spalten: <span className="font-medium">{cfg.columns}</span>.
                Die Reihenfolge ist egal, Groß-/Kleinschreibung auch. Erste Zeile = Überschriften.
              </div>

              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary hover:bg-primary-soft/40 transition"
              >
                <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <div className="font-medium">{busy ? 'Wird gelesen…' : 'Excel-Datei auswählen'}</div>
                <div className="text-xs text-gray-500 mt-1">.xlsx oder .xls</div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />

              <button onClick={downloadTemplate}
                      className="text-sm text-primary font-medium flex items-center gap-1.5 mx-auto">
                <Download className="w-4 h-4" /> Vorlage herunterladen
              </button>
            </>
          ) : (
            /* preview before anything is written */
            <>
              <div className="text-xs text-gray-500">{fileName}</div>
              <div className="grid grid-cols-3 gap-2">
                <Summary icon={CheckCircle2} tone="success" value={preview.okCount} label="werden angelegt" />
                <Summary icon={CopyMinus} tone="warning" value={preview.duplicateCount} label="übersprungen" />
                <Summary icon={AlertTriangle} tone="accent" value={preview.errorCount} label="Fehler" />
              </div>

              {preview.okCount === 0 && (
                <div className="bg-warning-soft text-warning text-sm rounded-lg p-3">
                  In dieser Datei ist keine einzige neue Zeile – es gibt nichts zu importieren.
                </div>
              )}

              <div className="border rounded-xl divide-y divide-gray-100 overflow-hidden">
                {preview.rows.map((r) => (
                  <div key={r.row} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-[11px] text-gray-400 w-8 shrink-0">Z{r.row}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${r.status === 'ERROR' ? 'text-gray-400' : ''}`}>
                        {cfg.label(r) || '—'}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {r.message || cfg.detail(r) || ''}
                      </div>
                    </div>
                    <Badge tone={tone[r.status]}>{statusText[r.status]}</Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="flex-1 border rounded-lg py-3 hover:bg-gray-50">
            {result ? 'Fertig' : 'Abbrechen'}
          </button>
          {preview && !result && (
            <button onClick={commit} disabled={busy || preview.okCount === 0}
                    className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              {busy ? 'Importiere…' : `${preview.okCount} importieren`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Summary({ icon: Icon, tone, value, label }) {
  const colors = {
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    accent: 'bg-accent-soft text-accent',
  }
  return (
    <div className={`rounded-lg p-3 text-center ${colors[tone]}`}>
      <Icon className="w-4 h-4 mx-auto mb-1" />
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="text-[11px] mt-1">{label}</div>
    </div>
  )
}
