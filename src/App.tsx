import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

const envTaskIcon = import.meta.env.VITE_TASK_ICON_URL
const envDebugToday = import.meta.env.VITE_DEBUG_TODAY

const assets = {
  heroNotebookImage: 'https://www.figma.com/api/mcp/asset/25820b3e-1dea-4d8a-bddf-368e547e2c85',
  heroNotebookMask: 'https://www.figma.com/api/mcp/asset/cf89929a-d211-496e-a392-2bbe36df1bf9',
  heroPetsImage: 'https://www.figma.com/api/mcp/asset/fa13714d-1f62-4688-8f9b-5a0fa29baad5',
  heroPetsMask: 'https://www.figma.com/api/mcp/asset/0bbe8734-c606-41a9-a8df-6b4cc5b8c12c',
  heroTitleMask: 'https://www.figma.com/api/mcp/asset/b7ec301c-9b8e-4ebf-86a7-546c7e6d4911',
  heroTitleImage: 'https://www.figma.com/api/mcp/asset/817e8ae8-8f7b-429f-b314-a073c5df9e8e',
  taskIcon: envTaskIcon ?? 'https://www.figma.com/api/mcp/asset/db0c0bce-f70e-4bfe-8b7e-8bebbbcb11c8',
  taskIcons: {
    snack: 'https://www.figma.com/api/mcp/asset/93db176e-1653-4c19-a251-212f8417a750',
    bath: 'https://www.figma.com/api/mcp/asset/e8c8fd55-3f5d-4f74-a9e9-d0c22a862544',
    play: 'https://www.figma.com/api/mcp/asset/ffe3be71-cda1-419b-8954-6ffddf43cf9b',
    clinic: 'https://www.figma.com/api/mcp/asset/195d4cf8-40e4-4e5b-b395-5de1bfcccd29',
    vaccine: 'https://www.figma.com/api/mcp/asset/de3e9327-3cf3-4e55-a258-acd440beb955',
  },
  emptyIllustration: 'https://www.figma.com/api/mcp/asset/f5b24d42-d1d9-42c0-97ac-c16c2966f92f',
  kittyLauncher: 'https://www.figma.com/api/mcp/asset/9ac326a4-cd49-4b7b-91cd-d7c01ca86ba0',
}

const CARD_ANIMATION_MS = 220
const MODAL_ANIMATION_MS = 220

type IconKey = keyof typeof assets.taskIcons

type ScheduleItem = {
  id: string
  title: string
  remindDateISO: string
  templateId?: string
  iconKey?: IconKey
}

type PetTab = {
  id: string
  label: string
}

type ModalMode = 'schedule' | 'pet' | null

const PET_NAME_MAX = 8
const HAS_PET_FLAG = 'pet-reminder-has-pet'
const PET_TIP_FLAG = 'pet-reminder-tip-dismissed'
const LONG_PRESS_THRESHOLD_MS = 650

const scheduleTemplates = [
  { id: 'bath', label: '洗澡', verb: '带', action: '去洗澡', iconKey: 'bath' as const },
  { id: 'groom', label: '美容', verb: '带', action: '去做美容', iconKey: 'snack' as const },
  { id: 'vaccine', label: '打疫苗', verb: '带', action: '去打疫苗', iconKey: 'vaccine' as const },
  { id: 'clinic', label: '就诊', verb: '带', action: '去就诊', iconKey: 'clinic' as const },
  { id: 'play', label: '出去玩', verb: '和', action: '一起出去玩', iconKey: 'play' as const },
]

const historyRecords: Record<string, Record<string, string[]>> = {
  'pet-123': {
    bath: ['2024-05-12', '2024-03-30', '2024-02-10'],
    groom: ['2024-05-01', '2024-02-20'],
    play: ['2024-06-01', '2024-04-18', '2024-04-05'],
    vaccine: ['2024-01-18', '2023-08-08'],
    clinic: ['2023-12-09'],
  },
  'pet-456': {
    bath: ['2024-05-25', '2024-04-10'],
    play: ['2024-05-28', '2024-05-02'],
    clinic: ['2024-03-16', '2023-11-03'],
  },
}

const dayOptions = Array.from({ length: 7 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1} 天后`,
}))
const longTermOptionValue = 'longer'

const formatDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const formatDisplayDate = (date: Date) =>
  `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`

const parseISODate = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

const clampDate = (source: Date) => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const max = new Date(now)
  max.setDate(max.getDate() + 14)
  if (source < now) return now
  if (source > max) return max
  return source
}

const initialPetTabs: PetTab[] = []

const initialSchedules: Record<string, ScheduleItem[]> = {}

type ScheduleCardProps = {
  item: ScheduleItem
  onComplete: () => void
  isRemoving: boolean
}

function ScheduleCard({ item, onComplete, isRemoving }: ScheduleCardProps) {
  const [hasEntered, setHasEntered] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setHasEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const iconSrc = (item.iconKey && assets.taskIcons[item.iconKey]) || assets.taskIcon
  const countdownDays = calcDaysRemaining(item.remindDateISO)
  const displayDate = formatDisplayDate(parseISODate(item.remindDateISO))
  const countdownLabel =
    countdownDays > 0
      ? `还差${countdownDays}天`
      : countdownDays === 0
        ? '今天提醒'
        : `已超${Math.abs(countdownDays)}天`

  const cardClassNames = ['schedule-card']
  if (hasEntered) cardClassNames.push('schedule-card--enter')
  if (isRemoving) cardClassNames.push('schedule-card--exit')

  return (
    <article className={cardClassNames.join(' ')} role="listitem">
      <div className="schedule-card__icon" aria-hidden="true">
        <img src={iconSrc} alt="" />
      </div>
      <div className="schedule-card__info">
        <p className="schedule-card__title">{item.title}</p>
        <p className="schedule-card__meta">提醒时间：{displayDate}</p>
      </div>
      <div className="schedule-card__state">
        <span className="schedule-card__countdown">{countdownLabel}</span>
        <button className="schedule-card__action pressable" type="button" onClick={onComplete}>
          完成
        </button>
      </div>
    </article>
  )
}

const calcDaysRemaining = (isoDate: string) => {
  const msPerDay = 24 * 60 * 60 * 1000
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = parseISODate(isoDate)
  target.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target.getTime() - today.getTime()) / msPerDay)
  return diff
}

function App() {
  const [pets, setPets] = useState<PetTab[]>(initialPetTabs)
  const [petSchedules, setPetSchedules] = useState<Record<string, ScheduleItem[]>>(initialSchedules)
  const [activePet, setActivePet] = useState<string>(initialPetTabs[0]?.id ?? '')
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const today = clampDate(envDebugToday ? parseISODate(envDebugToday) : new Date())
  const todayInput = formatDateInput(today)
  const maxScheduleDate = formatDateInput(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000))
  const calcFutureDate = (days: number) => {
    const base = new Date(today)
    base.setDate(base.getDate() + days)
    return clampDate(base)
  }
  const defaultDayOffset = 1
  const [selectedTemplateId, setSelectedTemplateId] = useState(scheduleTemplates[0].id)
  const [selectedDayOffset, setSelectedDayOffset] = useState<number | typeof longTermOptionValue>(defaultDayOffset)
  const [formDate, setFormDate] = useState(() => formatDateInput(calcFutureDate(defaultDayOffset)))
  const [petNickname, setPetNickname] = useState('')
  const [isModalClosing, setModalClosing] = useState(false)
  const [removingTaskIds, setRemovingTaskIds] = useState<string[]>([])
  const [holderShift, setHolderShift] = useState(0)
  const [holderAnimated, setHolderAnimated] = useState(false)
  const [historyModal, setHistoryModal] = useState<{ petId: string; templateId: string } | null>(null)
  const [historyModalClosing, setHistoryModalClosing] = useState(false)
  const [hasPetExperience, setHasPetExperience] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(HAS_PET_FLAG) === 'true'
  })
  const [petTipDismissed, setPetTipDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(PET_TIP_FLAG) === 'true'
  })
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' } | null>(null)
  const scheduleItems = useMemo(() => petSchedules[activePet] ?? [], [activePet, petSchedules])
  const sortedGroups = useMemo(() => {
    const enriched = scheduleItems.map((item) => ({
      item,
      daysRemaining: calcDaysRemaining(item.remindDateISO),
    }))
    const overdueItems = enriched
      .filter((entry) => entry.daysRemaining < 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .map((entry) => entry.item)
    const upcomingItems = enriched
      .filter((entry) => entry.daysRemaining >= 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .map((entry) => entry.item)
    return { overdueItems, upcomingItems }
  }, [scheduleItems])
  const { overdueItems, upcomingItems } = sortedGroups

  const modalTimerRef = useRef<number | null>(null)
  const removalTimersRef = useRef<Record<string, number>>({})
  const toastTimerRef = useRef<number | null>(null)
  const emptyHolderRef = useRef<HTMLDivElement | null>(null)
  const prevHolderTopRef = useRef<number | null>(null)
  const holderRafRef = useRef<number | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const historyCloseTimerRef = useRef<number | null>(null)
  const petTipRef = useRef<HTMLDivElement | null>(null)
  const shouldShowPetTip = !hasPetExperience && !petTipDismissed && pets.length === 0

  const clearModalTimer = () => {
    if (modalTimerRef.current) {
      window.clearTimeout(modalTimerRef.current)
      modalTimerRef.current = null
    }
  }

  const resetModalForm = () => {
    setSelectedTemplateId(scheduleTemplates[0].id)
    setSelectedDayOffset(defaultDayOffset)
    setFormDate(formatDateInput(calcFutureDate(defaultDayOffset)))
    setPetNickname('')
  }

  const showToast = (message: string, type: 'info' | 'error' = 'error') => {
    setToast({ message, type })
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 2200)
  }

  const openHistoryModal = (petId: string) => {
    if (historyCloseTimerRef.current) {
      window.clearTimeout(historyCloseTimerRef.current)
      historyCloseTimerRef.current = null
    }
    setHistoryModalClosing(false)
    setHistoryModal({ petId, templateId: scheduleTemplates[0].id })
  }

  const closeHistoryModal = () => {
    if (!historyModal) return
    setHistoryModalClosing(true)
    if (historyCloseTimerRef.current) {
      window.clearTimeout(historyCloseTimerRef.current)
    }
    historyCloseTimerRef.current = window.setTimeout(() => {
      setHistoryModal(null)
      setHistoryModalClosing(false)
      historyCloseTimerRef.current = null
    }, MODAL_ANIMATION_MS)
  }

  const startLongPress = (petId: string) => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
    }
    longPressTimerRef.current = window.setTimeout(() => {
      openHistoryModal(petId)
    }, LONG_PRESS_THRESHOLD_MS)
  }

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handlePetNicknameInput = (value: string) => {
    if (value.length > PET_NAME_MAX) {
      showToast(`宠物昵称最多${PET_NAME_MAX}个字符`, 'info')
    }
    setPetNickname(value.slice(0, PET_NAME_MAX))
  }

  const openModal = (mode: Exclude<ModalMode, null>) => {
    clearModalTimer()
    resetModalForm()
    setModalClosing(false)
    setModalMode(mode)
  }

  const closeModalWithAnimation = () => {
    if (!modalMode) return
    setModalClosing(true)
    clearModalTimer()
    modalTimerRef.current = window.setTimeout(() => {
      setModalMode(null)
      setModalClosing(false)
      resetModalForm()
    }, MODAL_ANIMATION_MS)
  }

  useEffect(() => {
    return () => {
      clearModalTimer()
      Object.values(removalTimersRef.current).forEach((timerId) => window.clearTimeout(timerId))
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = null
      }
      if (holderRafRef.current) {
        window.cancelAnimationFrame(holderRafRef.current)
        holderRafRef.current = null
      }
      cancelLongPress()
      if (historyCloseTimerRef.current) {
        window.clearTimeout(historyCloseTimerRef.current)
        historyCloseTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!shouldShowPetTip) {
      return
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (petTipRef.current && petTipRef.current.contains(event.target as Node)) {
        return
      }
      setPetTipDismissed(true)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PET_TIP_FLAG, 'true')
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [shouldShowPetTip])

useLayoutEffect(() => {
  const node = emptyHolderRef.current
  if (!node) return
  const prevTop = prevHolderTopRef.current
  const currentTop = node.getBoundingClientRect().top
  prevHolderTopRef.current = currentTop
  if (prevTop == null) return
  const delta = prevTop - currentTop
  if (Math.abs(delta) < 1) {
    setHolderAnimated(false)
    setHolderShift(0)
    return
  }
  setHolderAnimated(false)
  setHolderShift(delta)
  if (holderRafRef.current) {
    window.cancelAnimationFrame(holderRafRef.current)
    holderRafRef.current = null
  }
  holderRafRef.current = window.requestAnimationFrame(() => {
    setHolderAnimated(true)
    setHolderShift(0)
    holderRafRef.current = null
  })
}, [scheduleItems.length, activePet])

  const handleSelectPet = (petId: string) => {
    setActivePet(petId)
  }

  const handleCompleteTask = (petId: string, taskId: string) => {
    if (removingTaskIds.includes(taskId)) return
    setRemovingTaskIds((prev) => [...prev, taskId])
    const timerId = window.setTimeout(() => {
      setPetSchedules((prev) => {
        const next = { ...prev }
        next[petId] = (prev[petId] ?? []).filter((item) => item.id !== taskId)
        return next
      })
      setRemovingTaskIds((prev) => prev.filter((id) => id !== taskId))
      delete removalTimersRef.current[taskId]
    }, CARD_ANIMATION_MS)
    removalTimersRef.current[taskId] = timerId
  }

  const handleAddPet = (nickname: string) => {
    const newId = `pet-${Date.now()}`
    setPets((prev) => [...prev, { id: newId, label: nickname }])
    setPetSchedules((prev) => ({ ...prev, [newId]: [] }))
    setActivePet(newId)
    if (!hasPetExperience) {
      setHasPetExperience(true)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HAS_PET_FLAG, 'true')
      }
    }
    if (!petTipDismissed) {
      setPetTipDismissed(true)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PET_TIP_FLAG, 'true')
      }
    }
  }

  const handleDayOptionChange = (value: string) => {
    if (value === longTermOptionValue) {
      setSelectedDayOffset(longTermOptionValue)
      setFormDate(maxScheduleDate)
      return
    }
    const offset = Number(value)
    const target = calcFutureDate(offset)
    setSelectedDayOffset(offset)
    setFormDate(formatDateInput(target))
  }

  const handleDateChange = (value: string) => {
    setFormDate(value)
    setSelectedDayOffset(longTermOptionValue)
  }

  const handleModalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (modalMode === 'schedule') {
      if (!formDate) {
        showToast('请选择提醒日期')
        return
      }
      const template = scheduleTemplates.find((item) => item.id === selectedTemplateId) ?? scheduleTemplates[0]
      const petLabel = pets.find((pet) => pet.id === activePet)?.label ?? '小可爱'
      const targetDate =
        selectedDayOffset === longTermOptionValue ? parseISODate(formDate) : calcFutureDate(selectedDayOffset)
      const targetIso = formatDateInput(targetDate)
      const actionText = `${template.verb}${petLabel}${template.action}`
       const currentList = petSchedules[activePet] ?? []
       const hasDuplicate = currentList.some(
         (item) => item.title === actionText && item.remindDateISO === targetIso,
       )
       if (hasDuplicate) {
         showToast('已经存在相同的日程', 'info')
         return
       }
      const newItem: ScheduleItem = {
        id: `task-${Date.now()}`,
        title: actionText,
        remindDateISO: targetIso,
        templateId: template.id,
        iconKey: template.iconKey,
      }
      setPetSchedules((prev) => {
        const current = prev[activePet] ?? []
        return {
          ...prev,
          [activePet]: [...current, newItem],
        }
      })
    } else if (modalMode === 'pet') {
      const trimmedName = petNickname.trim()
      if (!trimmedName) {
        showToast('请输入宠物昵称')
        return
      }
      if (trimmedName.length > PET_NAME_MAX) {
        showToast(`宠物昵称最多${PET_NAME_MAX}个字符`, 'info')
        return
      }
      if (pets.some((pet) => pet.label === trimmedName)) {
        showToast('已经存在相同的宠物名称', 'info')
        return
      }
      handleAddPet(trimmedName)
    }
    closeModalWithAnimation()
  }

  const emptyHolderClassNames = ['empty-state-holder']
  if (scheduleItems.length === 0) {
    emptyHolderClassNames.push('empty-state-holder--center')
  } else {
    emptyHolderClassNames.push('empty-state-holder--float')
  }
  const motionDuration = 'var(--motion-duration)'
  const emptyHolderStyle =
    holderShift === 0 && !holderAnimated
      ? undefined
      : {
          transform: `translateY(${holderShift}px)`,
          transition: holderAnimated ? `transform ${motionDuration} cubic-bezier(0.25, 0.85, 0.25, 1)` : 'none',
        }
  const renderScheduleCard = (item: ScheduleItem) => (
    <ScheduleCard
      key={item.id}
      item={item}
      isRemoving={removingTaskIds.includes(item.id)}
      onComplete={() => handleCompleteTask(activePet, item.id)}
    />
  )
  return (
    <div className="app-shell">
      <div className="device-frame">
        <header className="hero-panel">
          <div className="hero-panel__note" aria-hidden="true">
            <div
              className="hero-panel__mask"
              style={{ maskImage: `url(${assets.heroNotebookMask})`, WebkitMaskImage: `url(${assets.heroNotebookMask})` }}
            >
              <img src={assets.heroNotebookImage} alt="" />
            </div>
          </div>

          <div className="hero-panel__content">
            <div className="hero-panel__title" aria-hidden="true">
              <div
                className="hero-panel__title-mask"
                style={{ maskImage: `url(${assets.heroTitleMask})`, WebkitMaskImage: `url(${assets.heroTitleMask})` }}
              >
                <img src={assets.heroTitleImage} alt="" />
              </div>
            </div>
            <span className="visually-hidden">宠物日程提醒</span>
          </div>

          <div className="hero-panel__pets" aria-hidden="true">
            <div
              className="hero-panel__mask"
              style={{ maskImage: `url(${assets.heroPetsMask})`, WebkitMaskImage: `url(${assets.heroPetsMask})` }}
            >
              <img src={assets.heroPetsImage} alt="" />
            </div>
          </div>
        </header>

        <section className="content-panel">
          <div className="tab-row" role="tablist" aria-label="宠物切换">
            {pets.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`pet-tab pressable ${activePet === tab.id ? 'pet-tab--active' : ''}`}
                role="tab"
                aria-selected={activePet === tab.id}
                onClick={() => handleSelectPet(tab.id)}
                onPointerDown={() => startLongPress(tab.id)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onContextMenu={(event) => event.preventDefault()}
              >
                <span className="pet-tab__indicator" aria-hidden="true" />
                {tab.label}
              </button>
            ))}
            <button
              type="button"
              className="pet-tab pet-tab--add pressable"
              aria-label="添加宠物"
              onClick={() => openModal('pet')}
            >
              <span className="pet-tab__indicator" aria-hidden="true" />
              <span className="pet-tab__add-symbol">+</span>
            </button>
            {shouldShowPetTip && (
              <div
                ref={petTipRef}
                className="pet-tip"
                onPointerDown={(event) => event.stopPropagation()}
                role="status"
                aria-live="polite"
              >
                <p className="pet-tip__text">新增宠物后即可开始记录日程</p>
                <span className="pet-tip__arrow" aria-hidden="true" />
              </div>
            )}
          </div>

          <div className={`schedule-list ${scheduleItems.length === 0 ? 'schedule-list--empty' : ''}`} role="list">
            {overdueItems.length > 0 && (
              <div className="schedule-group">{overdueItems.map((item) => renderScheduleCard(item))}</div>
            )}

            {upcomingItems.length > 0 && (
              <div className="schedule-group">{upcomingItems.map((item) => renderScheduleCard(item))}</div>
            )}

            <div ref={emptyHolderRef} className={emptyHolderClassNames.join(' ')} style={emptyHolderStyle}>
              <div className={`empty-state ${scheduleItems.length ? 'empty-state--muted' : ''}`}>
                <div className="empty-state__art-frame">
                  <img className="empty-state__art" src={assets.emptyIllustration} alt={scheduleItems.length ? '' : '猫狗插图'} />
                </div>
                {scheduleItems.length === 0 && <p className="empty-state__caption">暂时没有数据哦~</p>}
              </div>
            </div>
          </div>

          <div className="kitty-launcher-wrapper">
            <button
              type="button"
              className="kitty-launcher pressable"
              aria-label="新增日常"
              onClick={() => openModal('schedule')}
            >
              <img src={assets.kittyLauncher} alt="开启新增日常的小猫按钮" />
            </button>
          </div>
        </section>
      </div>

      {toast && (
        <div className={`toast toast--${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}

      {historyModal && (
        <div
          className={`history-overlay ${historyModalClosing ? 'history-overlay--exit' : 'history-overlay--enter'}`}
          aria-hidden={!historyModal}
        >
          <div
            className={`history-dialog ${historyModalClosing ? 'history-dialog--exit' : 'history-dialog--enter'}`}
            role="dialog"
            aria-modal="true"
          >
            <header className="history-dialog__header">
              <p className="history-dialog__title">
                {pets.find((pet) => pet.id === historyModal.petId)?.label ?? '宠物'} · 历程
              </p>
              <button className="history-dialog__close pressable" type="button" onClick={closeHistoryModal}>
                ×
              </button>
            </header>
            <div className="history-dialog__body">
              <label className="history-field">
                <span>选择日程</span>
                <select
                  value={historyModal.templateId}
                  onChange={(event) =>
                    setHistoryModal((prev) => (prev ? { ...prev, templateId: event.target.value } : prev))
                  }
                >
                  {scheduleTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>
              {(() => {
                const petHistory = historyRecords[historyModal.petId] ?? {}
                const entries = petHistory[historyModal.templateId] ?? []
                return (
                  <div className="history-list">
                    {entries.length > 0 ? (
                      entries.map((date, index) => (
                        <div key={date} className="history-list__item">
                          <span>第{index + 1}次</span>
                          <strong>{formatDisplayDate(parseISODate(date))}</strong>
                        </div>
                      ))
                    ) : (
                      <p className="history-empty">暂无记录</p>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {modalMode && (
        <div
          className={`composer-overlay ${isModalClosing ? 'composer-overlay--exit' : 'composer-overlay--enter'}`}
          role="dialog"
          aria-modal="true"
        >
          <div className={`composer-dialog ${isModalClosing ? 'composer-dialog--exit' : 'composer-dialog--enter'}`}>
            <header className="composer-dialog__header">
              <p className="composer-dialog__title">{modalMode === 'schedule' ? '新增日常' : '添加宠物'}</p>
              <button className="composer-dialog__close pressable" type="button" onClick={closeModalWithAnimation}>
                ×
              </button>
            </header>
            <form className="composer-form" onSubmit={handleModalSubmit}>
              {modalMode === 'schedule' ? (
                <>
                  <label className="composer-field">
                    <span>日程内容</span>
                    <select
                      value={selectedTemplateId}
                      onChange={(event) => setSelectedTemplateId(event.target.value)}
                      required
                    >
                      {scheduleTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="composer-field">
                    <span>几天后提醒</span>
                    <select
                      value={selectedDayOffset === longTermOptionValue ? longTermOptionValue : String(selectedDayOffset)}
                      onChange={(event) => handleDayOptionChange(event.target.value)}
                    >
                      {dayOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                      <option value={longTermOptionValue}>更久</option>
                    </select>
                  </label>
                  {selectedDayOffset === longTermOptionValue && (
                    <label className="composer-field">
                      <span>选择日期（最多两周）</span>
                      <input
                        type="date"
                        min={todayInput}
                        max={maxScheduleDate}
                        value={formDate}
                        onChange={(event) => handleDateChange(event.target.value)}
                        required
                      />
                    </label>
                  )}
                </>
              ) : (
                <label className="composer-field">
                  <span>宠物昵称</span>
                  <input
                    type="text"
                    placeholder="例如：可乐、团团"
                    value={petNickname}
                    maxLength={PET_NAME_MAX}
                    onChange={(event) => handlePetNicknameInput(event.target.value)}
                    required
                  />
                </label>
              )}
              <div className="composer-actions">
                <button className="composer-primary pressable" type="submit">
                  {modalMode === 'schedule' ? '保存' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
