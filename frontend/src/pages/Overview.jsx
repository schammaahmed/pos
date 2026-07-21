import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Coins, Euro, Tent, TrendingDown, Users } from 'lucide-react'
import { api } from '../api'
import { useCamp } from '../campContext'
import { Badge, EmptyState, SectionHeader } from '../components/ui'
import { fmt } from '../money'

// The super admin's home: every camp at a glance. Each card drills into that camp -
// it becomes the active camp (so all the camp pages follow) and opens its admin view.
export default function Overview() {
  const navigate = useNavigate()
  const { setActiveCamp } = useCamp()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api('/api/overview').then(setData).catch((e) => setError(e.message))
  }, [])

  function enterCamp(campId) {
    setActiveCamp(campId)
    navigate('/admin')
  }

  if (error) return <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>
  if (!data) return null

  return (
    <div className="space-y-6">
      <SectionHeader title="Übersicht" hint="Alle Camps auf einen Blick" />

      {/* global totals across every camp */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Total label="Umsatz gesamt" value={fmt(data.totalRevenue)} icon={Euro} tone="primary" />
        <Total label="Teilnehmer" value={data.totalParticipants} icon={Users} tone="info" />
        <Total label="Offene Schulden" value={fmt(data.totalOpenDebt)} icon={TrendingDown}
               tone={Number(data.totalOpenDebt) > 0 ? 'accent' : 'neutral'} />
        <Total label="Kassenstand (Soll)" value={fmt(data.totalCashExpected)} icon={Coins} tone="neutral" />
      </div>

      {/* one card per camp */}
      {data.camps.length === 0 ? (
        <EmptyState icon={Tent}>Noch keine Camps. Lege im Admin-Bereich das erste an.</EmptyState>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.camps.map((c) => (
            <button
              key={c.campId}
              onClick={() => enterCamp(c.campId)}
              className="text-left bg-white rounded-xl shadow-sm p-4 hover:shadow-md hover:ring-1 hover:ring-primary/30 transition group"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="font-bold truncate">{c.name}</div>
                  <div className="text-sm text-gray-500 truncate">{c.city}</div>
                </div>
                <Badge tone={c.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {c.status === 'ACTIVE' ? 'aktiv' : 'abgeschlossen'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <Figure icon={Euro} label="Umsatz" value={fmt(c.revenue)} />
                <Figure icon={Users} label="Teilnehmer" value={c.participantCount} />
                <Figure icon={TrendingDown} label="Schulden" value={fmt(c.openDebt)}
                        strong={Number(c.openDebt) > 0} />
                <Figure icon={Coins} label="Kasse" value={fmt(c.cashExpected)} />
              </div>

              <div className="flex items-center gap-1 text-primary text-sm font-semibold mt-3 group-hover:gap-2 transition-[gap]">
                Camp öffnen <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Total({ label, value, icon: Icon, tone }) {
  const tones = {
    primary: 'text-primary', info: 'text-info', accent: 'text-accent', neutral: 'text-gray-600',
  }
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 mb-1">
        <Icon className={`w-4 h-4 ${tones[tone]}`} /> {label}
      </div>
      <div className={`text-xl font-bold ${tones[tone]}`}>{value}</div>
    </div>
  )
}

function Figure({ icon: Icon, label, value, strong }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className="w-4 h-4 text-gray-300 shrink-0" />
      <span className="text-gray-500 truncate">{label}</span>
      <span className={`ml-auto shrink-0 ${strong ? 'font-bold text-accent' : 'font-semibold'}`}>{value}</span>
    </div>
  )
}
