import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
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
  createdAtISO: string
  templateId?: string
  iconKey?: IconKey
  muted?: boolean
}

type PetGender = 'male' | 'female' | 'unknown'

type PetProfile = {
  id: string
  label: string
  birthdayISO?: string
  ageYears?: number
  gender?: PetGender
}

type PetCenterPanel = 'info' | 'history'

const petCenterPanels: { id: PetCenterPanel; label: string }[] = [
  { id: 'info', label: '基础信息' },
  { id: 'history', label: '历程' },
]

const genderOptions: { value: PetGender; label: string }[] = [
  { value: 'unknown', label: '未设置' },
  { value: 'male', label: '男孩' },
  { value: 'female', label: '女孩' },
]

type ModalMode = 'schedule' | 'pet' | null

const PET_NAME_MAX = 8
const HAS_PET_FLAG = 'pet-reminder-has-pet'
const BIRTHDAY_TEMPLATE_ID = 'pet-birthday-reminder'
const LONG_PRESS_THRESHOLD_MS = 650

const scheduleTemplates = [
  { id: 'bath', label: '洗澡', verb: '带', action: '去洗澡', iconKey: 'bath' as const },
  { id: 'groom', label: '美容', verb: '带', action: '去做美容', iconKey: 'snack' as const },
  { id: 'vaccine', label: '打疫苗', verb: '带', action: '去打疫苗', iconKey: 'vaccine' as const },
  { id: 'clinic', label: '就诊', verb: '带', action: '去就诊', iconKey: 'clinic' as const },
  { id: 'play', label: '出去玩', verb: '和', action: '一起出去玩', iconKey: 'play' as const },
]

const initialHistoryRecords: Record<string, Record<string, string[]>> = {
  'pet-test1': {
    bath: ['2024-05-12', '2024-03-30', '2024-02-10'],
    vaccine: ['2024-01-18', '2023-08-08'],
  },
  'pet-test2': {
    clinic: ['2023-12-09', '2023-08-15'],
    groom: ['2024-04-01'],
  },
}

const formatDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const formatDisplayDate = (date: Date) =>
  `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`

const parseISODate = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

const toBeijingDate = (date: Date) => {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000
  return new Date(utc + 8 * 60 * 60 * 1000)
}

const getBeijingNow = () => {
  if (envDebugToday) {
    const debug = parseISODate(envDebugToday)
    return new Date(debug.getTime())
  }
  return toBeijingDate(new Date())
}

const getBeijingToday = () => {
  const now = getBeijingNow()
  now.setHours(0, 0, 0, 0)
  return now
}

const clampDate = (source: Date) => {
  const now = getBeijingToday()
  if (source < now) return now
  return source
}

const formatOffsetDate = (daysOffset: number) => {
  const base = getBeijingToday()
  base.setDate(base.getDate() + daysOffset)
  return formatDateInput(base)
}

const computeInitialAgeYears = (birthdayISO: string) => {
  const birthday = parseISODate(birthdayISO)
  const today = getBeijingNow()
  birthday.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  let years = today.getFullYear() - birthday.getFullYear()
  const birthdayMonth = birthday.getMonth()
  const birthdayDay = birthday.getDate()
  const hasNotReachedBirthdayThisYear =
    today.getMonth() < birthdayMonth ||
    (today.getMonth() === birthdayMonth && today.getDate() < birthdayDay)
  if (hasNotReachedBirthdayThisYear) {
    years -= 1
  }
  return Math.max(years, 0)
}

function buildPet(id: string, label: string, options?: { birthday?: string; gender?: PetGender }) {
  const profile: PetProfile = { id, label, gender: options?.gender ?? 'unknown' }
  if (options?.birthday) {
    profile.birthdayISO = options.birthday
    profile.ageYears = computeInitialAgeYears(options.birthday)
  }
  return profile
}

const initialPetTabs: PetProfile[] = [
  buildPet('pet-test1', '测试1', { birthday: '2021-03-15', gender: 'female' }),
  buildPet('pet-test2', '测试2', { birthday: '2019-11-28', gender: 'male' }),
]

const initialSchedules: Record<string, ScheduleItem[]> = {
  'pet-test1': [
    {
      id: 'task-test1-bath',
      title: '带测试1去洗澡',
      remindDateISO: formatOffsetDate(-3),
      templateId: 'bath',
      iconKey: 'bath',
      createdAtISO: formatDateInput(getBeijingToday()),
    },
    {
      id: 'task-test1-vaccine',
      title: '带测试1去打疫苗',
      remindDateISO: formatDateInput(
        clampDate(new Date(getBeijingNow().getTime() + 30 * 24 * 60 * 60 * 1000)),
      ),
      templateId: 'vaccine',
      iconKey: 'vaccine',
      createdAtISO: formatDateInput(getBeijingToday()),
    },
  ],
  'pet-test2': [
    {
      id: 'task-test2-clinic',
      title: '带测试2去就诊',
      remindDateISO: formatOffsetDate(-1),
      templateId: 'clinic',
      iconKey: 'clinic',
      createdAtISO: formatDateInput(getBeijingToday()),
    },
    {
      id: 'task-test2-groom',
      title: '带测试2去做美容',
      remindDateISO: formatOffsetDate(-2),
      templateId: 'groom',
      iconKey: 'snack',
      createdAtISO: formatDateInput(getBeijingToday()),
    },
  ],
}

const getTemplateById = (id?: string) => scheduleTemplates.find((template) => template.id === id)

const buildScheduleTitle = (templateId: string | undefined, petLabel: string, fallback: string) => {
  if (!petLabel) return fallback
  if (templateId === BIRTHDAY_TEMPLATE_ID) {
    return `${petLabel}的生日提醒`
  }
  const template = getTemplateById(templateId)
  if (!template) return fallback
  return `${template.verb}${petLabel}${template.action}`
}

const getNextBirthdayISO = (birthdayISO: string, referenceDate?: Date) => {
  if (!birthdayISO) return ''
  const now = referenceDate ? new Date(referenceDate) : getBeijingNow()
  now.setHours(0, 0, 0, 0)
  const [, month, day] = birthdayISO.split('-').map(Number)
  if (!month || !day) return ''
  const candidate = new Date(now.getFullYear(), (month ?? 1) - 1, day ?? 1)
  candidate.setHours(0, 0, 0, 0)
  if (candidate <= now) {
    candidate.setFullYear(candidate.getFullYear() + 1)
  }
  return formatDateInput(candidate)
}

type ScheduleCardProps = {
  item: ScheduleItem
  onComplete: () => void
  isRemoving: boolean
  onLongPress: (event: ReactPointerEvent<HTMLElement>) => void
  onPressCancel: () => void
}

function ScheduleCard({ item, onComplete, isRemoving, onLongPress, onPressCancel }: ScheduleCardProps) {
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
        : `逾期${Math.abs(countdownDays)}天`

  const cardClassNames = ['schedule-card']
  if (hasEntered) cardClassNames.push('schedule-card--enter')
  if (isRemoving) cardClassNames.push('schedule-card--exit')

  return (
    <article
      className={cardClassNames.join(' ')}
      role="listitem"
      onPointerDown={onLongPress}
      onPointerUp={onPressCancel}
      onPointerLeave={onPressCancel}
      onPointerCancel={onPressCancel}
      onContextMenu={(event) => event.preventDefault()}
    >
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
  const today = getBeijingNow()
  today.setHours(0, 0, 0, 0)
  const target = parseISODate(isoDate)
  target.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target.getTime() - today.getTime()) / msPerDay)
  return diff
}

function App() {
  const [pets, setPets] = useState<PetProfile[]>(initialPetTabs)
  const [petSchedules, setPetSchedules] = useState<Record<string, ScheduleItem[]>>(initialSchedules)
  const [activePet, setActivePet] = useState<string>(initialPetTabs[0]?.id ?? '')
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const today = envDebugToday ? clampDate(parseISODate(envDebugToday)) : getBeijingToday()
  const todayInput = formatDateInput(today)
  const calcFutureDate = (days: number) => {
    const base = new Date(today)
    base.setDate(base.getDate() + days)
    base.setHours(0, 0, 0, 0)
    return base
  }
  const defaultDayOffset = 1
  const [selectedTemplateId, setSelectedTemplateId] = useState(scheduleTemplates[0].id)
  const [formDate, setFormDate] = useState(() => formatDateInput(calcFutureDate(defaultDayOffset)))
  const [petNickname, setPetNickname] = useState('')
  const [isModalClosing, setModalClosing] = useState(false)
  const [removingTaskIds, setRemovingTaskIds] = useState<string[]>([])
  const [holderShift, setHolderShift] = useState(0)
  const [holderAnimated, setHolderAnimated] = useState(false)
  const [petCenterModal, setPetCenterModal] = useState<{
    petId: string
    templateId: string
    nameInput: string
    birthdayInput: string
    activePanel: PetCenterPanel
    genderInput: PetGender
  } | null>(null)
  const [petCenterClosing, setPetCenterClosing] = useState(false)
  const [hasPetExperience, setHasPetExperience] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(HAS_PET_FLAG) === 'true'
  })
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' } | null>(null)
  const [historyRecords, setHistoryRecords] = useState(initialHistoryRecords)
  const [nextSchedulePrompt, setNextSchedulePrompt] = useState<{
    petId: string
    templateId: string
    actionText: string
    iconKey?: IconKey
    petLabel: string
  } | null>(null)
  const [nextScheduleDate, setNextScheduleDate] = useState(todayInput)
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
  const petCenterCloseTimerRef = useRef<number | null>(null)
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null)
  const [earlyPromptTask, setEarlyPromptTask] = useState<{ petId: string; task: ScheduleItem } | null>(null)
  const [overduePromptTask, setOverduePromptTask] = useState<{ petId: string; task: ScheduleItem } | null>(null)
  const [overduePromptDate, setOverduePromptDate] = useState(todayInput)
  const [taskMenu, setTaskMenu] = useState<{
    petId: string
    task: ScheduleItem
    position: { x: number; y: number }
  } | null>(null)
  const [taskMenuDate, setTaskMenuDate] = useState(todayInput)

  const clearModalTimer = () => {
    if (modalTimerRef.current) {
      window.clearTimeout(modalTimerRef.current)
      modalTimerRef.current = null
    }
  }

  const resetModalForm = () => {
    setSelectedTemplateId(scheduleTemplates[0].id)
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

  const openPetCenterModal = (petId: string) => {
    if (petCenterCloseTimerRef.current) {
      window.clearTimeout(petCenterCloseTimerRef.current)
      petCenterCloseTimerRef.current = null
    }
    const currentPet = pets.find((pet) => pet.id === petId)
    setPetCenterClosing(false)
    setPetCenterModal({
      petId,
      templateId: scheduleTemplates[0].id,
      nameInput: currentPet?.label ?? '',
      birthdayInput: currentPet?.birthdayISO ?? '',
      genderInput: currentPet?.gender ?? 'unknown',
      activePanel: 'info',
    })
  }

  const closePetCenterModal = () => {
    if (!petCenterModal) return
    setPetCenterClosing(true)
    if (petCenterCloseTimerRef.current) {
      window.clearTimeout(petCenterCloseTimerRef.current)
    }
    petCenterCloseTimerRef.current = window.setTimeout(() => {
      setPetCenterModal(null)
      setPetCenterClosing(false)
      petCenterCloseTimerRef.current = null
    }, MODAL_ANIMATION_MS)
  }

  const switchPetCenterPanel = (panel: PetCenterPanel) => {
    setPetCenterModal((prev) => (prev ? { ...prev, activePanel: panel } : prev))
  }

  const startLongPress = (petId: string, task?: ScheduleItem) => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
    }
    longPressTimerRef.current = window.setTimeout(() => {
      if (task) {
        const position = pointerPositionRef.current ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
        setTaskMenu({ petId, task, position })
        setTaskMenuDate(task.remindDateISO)
      } else {
        openPetCenterModal(petId)
      }
    }, LONG_PRESS_THRESHOLD_MS)
  }

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    pointerPositionRef.current = null
  }

  const closeTaskMenu = () => {
    setTaskMenu(null)
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
      if (petCenterCloseTimerRef.current) {
        window.clearTimeout(petCenterCloseTimerRef.current)
        petCenterCloseTimerRef.current = null
      }
    }
  }, [])

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

  const shouldSuggestEarlyCompletion = useCallback((item: ScheduleItem) => {
    if (!item.createdAtISO || item.muted) return false
    const createdAt = parseISODate(item.createdAtISO)
    createdAt.setHours(0, 0, 0, 0)
    const target = parseISODate(item.remindDateISO)
    target.setHours(0, 0, 0, 0)
    const totalMs = target.getTime() - createdAt.getTime()
    if (totalMs <= 0) return false
    const now = getBeijingNow()
    now.setHours(0, 0, 0, 0)
    const elapsedMs = now.getTime() - createdAt.getTime()
    if (elapsedMs < 0) return false
    const ratio = elapsedMs / totalMs
    return ratio < 0.75 && calcDaysRemaining(item.remindDateISO) > 7
  }, [])

  useEffect(() => {
    if (overduePromptTask) return
    if (!activePet) return
    const list = petSchedules[activePet] ?? []
    const candidate = list.find((item) => calcDaysRemaining(item.remindDateISO) < 0 && !item.muted)
    if (candidate) {
      setOverduePromptTask({ petId: activePet, task: candidate })
      setOverduePromptDate(todayInput)
    }
  }, [activePet, petSchedules, overduePromptTask, todayInput])

  const handleSelectPet = (petId: string) => {
    setActivePet(petId)
  }

  const handleCompleteTask = (petId: string, taskId: string, options?: { ignoreEarlyCheck?: boolean }) => {
    const currentList = petSchedules[petId] ?? []
    const targetItem = currentList.find((item) => item.id === taskId)
    if (!targetItem) return
    if (!options?.ignoreEarlyCheck && shouldSuggestEarlyCompletion(targetItem)) {
      setEarlyPromptTask({ petId, task: targetItem })
      return
    }
    if (targetItem.templateId === BIRTHDAY_TEMPLATE_ID) {
      const petProfile = pets.find((pet) => pet.id === petId)
      if (petProfile?.birthdayISO) {
        const reference = parseISODate(targetItem.remindDateISO)
        reference.setFullYear(reference.getFullYear(), reference.getMonth(), reference.getDate())
        reference.setHours(0, 0, 0, 0)
        const nextBirthday = getNextBirthdayISO(petProfile.birthdayISO, reference)
        if (nextBirthday) {
          setPetSchedules((prev) => {
            const list = prev[petId] ?? []
            const updated = list.map((item) =>
              item.id === taskId ? { ...item, remindDateISO: nextBirthday, createdAtISO: todayInput, muted: false } : item,
            )
            return { ...prev, [petId]: updated }
          })
          incrementPetAge(petId)
          appendHistoryEntry(petId, targetItem.templateId, todayInput)
          showToast('已为下次生日生成提醒', 'info')
        }
      }
      return
    }
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
    appendHistoryEntry(petId, targetItem.templateId, todayInput)
    if (targetItem.templateId && targetItem.templateId !== BIRTHDAY_TEMPLATE_ID) {
      const template = scheduleTemplates.find((tpl) => tpl.id === targetItem.templateId)
      const petLabel = pets.find((pet) => pet.id === petId)?.label ?? '小可爱'
      if (template) {
        setNextSchedulePrompt({
          petId,
          templateId: template.id,
          actionText: `${template.verb}${petLabel}${template.action}`,
          iconKey: template.iconKey,
          petLabel,
        })
        setNextScheduleDate(
          targetItem.remindDateISO > todayInput ? targetItem.remindDateISO : todayInput,
        )
      }
    }
  }

  const handleAddPet = (nickname: string) => {
    const newId = `pet-${Date.now()}`
    setPets((prev) => [...prev, { id: newId, label: nickname, gender: 'unknown' }])
    setPetSchedules((prev) => ({ ...prev, [newId]: [] }))
    setActivePet(newId)
    if (!hasPetExperience) {
      setHasPetExperience(true)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HAS_PET_FLAG, 'true')
      }
    }
  }

  const ensureBirthdayReminder = useCallback((petId: string, petLabel: string, birthdayISO?: string) => {
    if (!birthdayISO) return
    const nextReminderISO = getNextBirthdayISO(birthdayISO)
    if (!nextReminderISO) return
    setPetSchedules((prev) => {
      const currentList = prev[petId] ?? []
      const reminderTitle = `${petLabel}的生日提醒`
      const existingIndex = currentList.findIndex((item) => item.templateId === BIRTHDAY_TEMPLATE_ID)
      if (existingIndex === -1) {
        const newItem: ScheduleItem = {
          id: `${BIRTHDAY_TEMPLATE_ID}-${petId}`,
          title: reminderTitle,
          remindDateISO: nextReminderISO,
          createdAtISO: todayInput,
          templateId: BIRTHDAY_TEMPLATE_ID,
          iconKey: 'play',
          muted: false,
        }
        return {
          ...prev,
          [petId]: [...currentList, newItem],
        }
      }
      const existing = currentList[existingIndex]
      if (existing.remindDateISO === nextReminderISO && existing.title === reminderTitle) {
        return prev
      }
      const nextList = [...currentList]
      nextList[existingIndex] = {
        ...existing,
        title: reminderTitle,
        remindDateISO: nextReminderISO,
        createdAtISO: todayInput,
        muted: false,
      }
      return { ...prev, [petId]: nextList }
    })
  }, [todayInput])

  const incrementPetAge = (petId: string) => {
    setPets((prev) =>
      prev.map((pet) => {
        if (pet.id !== petId) return pet
        const baseline =
          pet.ageYears ??
          (pet.birthdayISO ? computeInitialAgeYears(pet.birthdayISO) : 0)
        return { ...pet, ageYears: baseline + 1 }
      }),
    )
  }

  const appendHistoryEntry = useCallback(
    (petId: string, templateId?: string, dateISO?: string) => {
      if (!templateId) return
      const stamp = dateISO ?? todayInput
      setHistoryRecords((prev) => {
        const petHistory = prev[petId] ?? {}
        const templateHistory = petHistory[templateId] ?? []
        return {
          ...prev,
          [petId]: {
            ...petHistory,
            [templateId]: [stamp, ...templateHistory],
          },
        }
      })
    },
    [todayInput],
  )

  const syncPetScheduleTitles = (petId: string, petLabel: string) => {
    setPetSchedules((prev) => {
      const current = prev[petId]
      if (!current) return prev
      const nextList = current.map((item) => {
        if (!item.templateId) return item
        const nextTitle = buildScheduleTitle(item.templateId, petLabel, item.title)
        if (nextTitle === item.title) return item
        return { ...item, title: nextTitle }
      })
      return { ...prev, [petId]: nextList }
    })
  }

  const handleSavePetProfile = () => {
    if (!petCenterModal) return
    const rawName = petCenterModal.nameInput
    const trimmedName = rawName.trim()
    if (!trimmedName) {
      showToast('请输入宠物昵称')
      return
    }
    if (trimmedName.length > PET_NAME_MAX) {
      showToast(`宠物昵称最多${PET_NAME_MAX}个字符`, 'info')
      return
    }
    if (/\s/.test(rawName)) {
      showToast('宠物昵称不能包含空格', 'info')
      return
    }
    if (pets.some((pet) => pet.label === trimmedName && pet.id !== petCenterModal.petId)) {
      showToast('已经存在相同的宠物名称', 'info')
      return
    }
    const petRecord = pets.find((pet) => pet.id === petCenterModal.petId)
    if (!petRecord) return
    const nameChanged = petRecord.label !== trimmedName
    const birthdayChanged = (petRecord.birthdayISO ?? '') !== (petCenterModal.birthdayInput ?? '')
    const genderChanged = (petRecord.gender ?? 'unknown') !== petCenterModal.genderInput
    if (!nameChanged && !birthdayChanged && !genderChanged) {
      showToast('信息未发生变化', 'info')
      return
    }
    const birthdayInput = petCenterModal.birthdayInput
    if (birthdayInput) {
      const birthdayDate = parseISODate(birthdayInput)
      const todayDate = parseISODate(todayInput)
      birthdayDate.setHours(0, 0, 0, 0)
      todayDate.setHours(0, 0, 0, 0)
      if (birthdayDate > todayDate) {
        showToast('生日不能设置在未来', 'info')
        return
      }
    }
    setPets((prev) =>
      prev.map((pet) => {
        if (pet.id !== petCenterModal.petId) return pet
        const next: PetProfile = { ...pet, label: trimmedName, gender: petCenterModal.genderInput }
        if (birthdayInput) {
          next.birthdayISO = birthdayInput
          next.ageYears = computeInitialAgeYears(birthdayInput)
        } else {
          next.birthdayISO = undefined
          next.ageYears = undefined
        }
        return next
      }),
    )
    if (nameChanged) {
      syncPetScheduleTitles(petCenterModal.petId, trimmedName)
    }
    if (birthdayInput) {
      ensureBirthdayReminder(petCenterModal.petId, trimmedName, birthdayInput)
    }
    setPetCenterModal((prev) =>
      prev
        ? {
            ...prev,
            nameInput: trimmedName,
            birthdayInput: petCenterModal.birthdayInput,
            genderInput: petCenterModal.genderInput,
          }
        : prev,
    )
    showToast('宠物信息已保存', 'info')
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
      const targetDate = parseISODate(formDate)
      const targetIso = formatDateInput(targetDate)
      const actionText = `${template.verb}${petLabel}${template.action}`
      const currentList = petSchedules[activePet] ?? []
      const hasDuplicate = currentList.some((item) => item.title === actionText && item.remindDateISO === targetIso)
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
        createdAtISO: todayInput,
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
      if (/\s/.test(petNickname)) {
        showToast('宠物昵称不能包含空格', 'info')
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

  const handleEarlyPromptComplete = () => {
    if (!earlyPromptTask) return
    handleCompleteTask(earlyPromptTask.petId, earlyPromptTask.task.id, { ignoreEarlyCheck: true })
    setEarlyPromptTask(null)
  }

  const handleEarlyPromptSkip = () => {
    if (!earlyPromptTask) return
    setEarlyPromptTask(null)
  }

  const handlePostponeOverdue = () => {
    if (!overduePromptTask) return
    if (!overduePromptDate) {
      showToast('请选择延期日期')
      return
    }
    setPetSchedules((prev) => {
      const current = prev[overduePromptTask.petId] ?? []
      const nextList = current.map((item) =>
        item.id === overduePromptTask.task.id
          ? { ...item, remindDateISO: overduePromptDate, createdAtISO: todayInput, muted: false }
          : item,
      )
      return { ...prev, [overduePromptTask.petId]: nextList }
    })
    setOverduePromptTask(null)
  }

  const handleMuteOverdue = () => {
    if (!overduePromptTask) return
    setPetSchedules((prev) => {
      const current = prev[overduePromptTask.petId] ?? []
      const nextList = current.map((item) =>
        item.id === overduePromptTask.task.id ? { ...item, muted: true } : item,
      )
      return { ...prev, [overduePromptTask.petId]: nextList }
    })
    setOverduePromptTask(null)
  }

  const handleSkipNextSchedule = () => {
    setNextSchedulePrompt(null)
    setNextScheduleDate(todayInput)
  }

  const handleConfirmNextSchedule = () => {
    if (!nextSchedulePrompt) return
    if (!nextScheduleDate) {
      showToast('请选择下次时间')
      return
    }
    const targetDate = parseISODate(nextScheduleDate)
    targetDate.setHours(0, 0, 0, 0)
    const todayDate = parseISODate(todayInput)
    todayDate.setHours(0, 0, 0, 0)
    if (targetDate < todayDate) {
      showToast('请选择今天之后的日期', 'info')
      return
    }
    const currentList = petSchedules[nextSchedulePrompt.petId] ?? []
    const duplicate = currentList.some(
      (item) => item.title === nextSchedulePrompt.actionText && item.remindDateISO === nextScheduleDate,
    )
    if (duplicate) {
      showToast('已经存在相同的日程', 'info')
      return
    }
    const newItem: ScheduleItem = {
      id: `task-${Date.now()}`,
      title: nextSchedulePrompt.actionText,
      remindDateISO: nextScheduleDate,
      templateId: nextSchedulePrompt.templateId,
      iconKey: nextSchedulePrompt.iconKey,
      createdAtISO: todayInput,
    }
    setPetSchedules((prev) => {
      const current = prev[nextSchedulePrompt.petId] ?? []
      return {
        ...prev,
        [nextSchedulePrompt.petId]: [...current, newItem],
      }
    })
    showToast('已预约下一次', 'info')
    handleSkipNextSchedule()
  }

  const handleTaskMenuDelete = () => {
    if (!taskMenu) return
    setPetSchedules((prev) => {
      const next = { ...prev }
      next[taskMenu.petId] = (prev[taskMenu.petId] ?? []).filter((item) => item.id !== taskMenu.task.id)
      return next
    })
    closeTaskMenu()
  }

  const handleTaskMenuReschedule = () => {
    if (!taskMenu) return
    const targetDate = parseISODate(taskMenuDate)
    const today = getBeijingToday()
    if (targetDate < today) {
      showToast('请选择今天之后的日期', 'info')
      return
    }
    setPetSchedules((prev) => {
      const current = prev[taskMenu.petId] ?? []
      const nextList = current.map((item) =>
        item.id === taskMenu.task.id ? { ...item, remindDateISO: taskMenuDate, createdAtISO: todayInput } : item,
      )
      return { ...prev, [taskMenu.petId]: nextList }
    })
    closeTaskMenu()
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
  const handleCardPointerDown = (event: ReactPointerEvent<HTMLElement>, item: ScheduleItem) => {
    if ((event.target as HTMLElement).closest('.schedule-card__action')) return
    pointerPositionRef.current = { x: event.clientX, y: event.clientY }
    startLongPress(activePet, item)
  }

  const renderScheduleCard = (item: ScheduleItem) => (
    <ScheduleCard
      key={item.id}
      item={item}
      isRemoving={removingTaskIds.includes(item.id)}
      onComplete={() => handleCompleteTask(activePet, item.id)}
      onLongPress={(event) => handleCardPointerDown(event, item)}
      onPressCancel={cancelLongPress}
    />
  )
  const currentPetProfile =
    petCenterModal ? pets.find((pet) => pet.id === petCenterModal.petId) ?? null : null
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

      {petCenterModal && (
        <div
          className={`history-overlay ${petCenterClosing ? 'history-overlay--exit' : 'history-overlay--enter'}`}
          aria-hidden={!petCenterModal}
        >
          <div
            className={`history-dialog ${petCenterClosing ? 'history-dialog--exit' : 'history-dialog--enter'}`}
            role="dialog"
            aria-modal="true"
          >
            <header className="history-dialog__header">
              <p className="history-dialog__title">
                {currentPetProfile?.label ?? '宠物'} · 综合信息
              </p>
              <button className="history-dialog__close pressable" type="button" onClick={closePetCenterModal}>
                ×
              </button>
            </header>
            <div className="history-dialog__body">
              <div className="pet-center">
                <div className="pet-center__menu" role="tablist" aria-orientation="vertical">
                  {petCenterPanels.map((panel) => (
                    <button
                      key={panel.id}
                      type="button"
                      role="tab"
                      aria-selected={petCenterModal.activePanel === panel.id}
                      className={`pet-center__menu-btn ${
                        petCenterModal.activePanel === panel.id ? 'pet-center__menu-btn--active' : ''
                      }`}
                      onClick={() => switchPetCenterPanel(panel.id)}
                    >
                      {panel.label}
                    </button>
                  ))}
                </div>
                <div className="pet-center__content">
                  {petCenterModal.activePanel === 'info' ? (
                    <div className="pet-center__section">
                      <p className="pet-age-line">
                        当前年龄：
                        {currentPetProfile?.birthdayISO
                          ? currentPetProfile?.ageYears != null
                            ? `${currentPetProfile.ageYears}岁`
                            : '未设置'
                          : '生日未设置'}
                      </p>
                      <label className="history-field">
                        <span>宠物昵称</span>
                        <input
                          type="text"
                          value={petCenterModal.nameInput}
                          maxLength={PET_NAME_MAX}
                          onChange={(event) =>
                            setPetCenterModal((prev) => (prev ? { ...prev, nameInput: event.target.value } : prev))
                          }
                        />
                      </label>
                      <label className="history-field">
                        <span>生日（用于自动提醒）</span>
                        <input
                          type="date"
                          value={petCenterModal.birthdayInput}
                          onChange={(event) =>
                            setPetCenterModal((prev) => (prev ? { ...prev, birthdayInput: event.target.value } : prev))
                          }
                        />
                      </label>
                      {petCenterModal.birthdayInput && (
                        <p className="pet-age-hint">生日：{petCenterModal.birthdayInput}</p>
                      )}
                      <label className="history-field">
                        <span>性别</span>
                        <select
                          value={petCenterModal.genderInput}
                          onChange={(event) =>
                            setPetCenterModal((prev) =>
                              prev ? { ...prev, genderInput: event.target.value as PetGender } : prev,
                            )
                          }
                        >
                          {genderOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="history-actions">
                        <button className="composer-primary pressable" type="button" onClick={handleSavePetProfile}>
                          保存信息
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pet-center__section">
                      <label className="history-field">
                        <span>选择日程</span>
                        <select
                          value={petCenterModal.templateId}
                          onChange={(event) =>
                            setPetCenterModal((prev) => (prev ? { ...prev, templateId: event.target.value } : prev))
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
                        const petHistory = historyRecords[petCenterModal.petId] ?? {}
                        const entries = petHistory[petCenterModal.templateId] ?? []
                        return (
                          <div className="history-list">
                            {entries.length > 0 ? (
                              entries.map((date, index) => (
                                <div key={`${date}-${index}`} className="history-list__item">
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
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {earlyPromptTask && (
        <div className="composer-overlay composer-overlay--enter" role="dialog" aria-modal="true">
          <div className="composer-dialog composer-dialog--enter">
            <header className="composer-dialog__header">
              <p className="composer-dialog__title">提前完成提醒</p>
              <button className="composer-dialog__close pressable" type="button" onClick={handleEarlyPromptSkip}>
                ×
              </button>
            </header>
            <div className="composer-form">
              <p className="prompt-text">
                {pets.find((pet) => pet.id === earlyPromptTask.petId)?.label ?? '宠物'} 的「
                {earlyPromptTask.task.title}」还有 {calcDaysRemaining(earlyPromptTask.task.remindDateISO)} 天，
                是否提前完成？
              </p>
              <div className="composer-actions composer-actions--spread">
                <button className="composer-secondary pressable" type="button" onClick={handleEarlyPromptSkip}>
                  否
                </button>
                <button className="composer-primary pressable" type="button" onClick={handleEarlyPromptComplete}>
                  是
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {overduePromptTask && (
        <div className="composer-overlay composer-overlay--enter" role="dialog" aria-modal="true">
          <div className="composer-dialog composer-dialog--enter">
            <header className="composer-dialog__header">
              <p className="composer-dialog__title">逾期提醒</p>
              <button className="composer-dialog__close pressable" type="button" onClick={handleMuteOverdue}>
                ×
              </button>
            </header>
            <div className="composer-form">
              <p className="prompt-text">
                {pets.find((pet) => pet.id === overduePromptTask.petId)?.label ?? '宠物'} 的「
                {overduePromptTask.task.title}」已逾期 {Math.abs(calcDaysRemaining(overduePromptTask.task.remindDateISO))} 天。
              </p>
              <label className="composer-field">
                <span>延期至</span>
                <input
                  type="date"
                  min={todayInput}
                  value={overduePromptDate}
                  onChange={(event) => setOverduePromptDate(event.target.value)}
                />
              </label>
              <div className="composer-actions composer-actions--spread">
                <button className="composer-secondary pressable" type="button" onClick={handleMuteOverdue}>
                  不再提醒
                </button>
                <button className="composer-primary pressable" type="button" onClick={handlePostponeOverdue}>
                  延期
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {taskMenu && (
        <div className="context-menu-overlay" onClick={closeTaskMenu}>
          <div
            className="context-menu"
            style={{ top: `${taskMenu.position.y}px`, left: `${taskMenu.position.x}px` }}
            onClick={(event) => event.stopPropagation()}
          >
            <p className="context-menu__title">{taskMenu.task.title}</p>
            <label className="context-menu__field">
              <span>提醒日期</span>
              <input
                type="date"
                min={todayInput}
                value={taskMenuDate}
                onChange={(event) => setTaskMenuDate(event.target.value)}
              />
            </label>
            <div className="context-menu__actions">
              <button className="context-menu__btn" type="button" onClick={handleTaskMenuReschedule}>
                保存日期
              </button>
              <button className="context-menu__btn context-menu__btn--danger" type="button" onClick={handleTaskMenuDelete}>
                删除
              </button>
              <button className="context-menu__btn" type="button" onClick={closeTaskMenu}>
                转发
              </button>
            </div>
          </div>
        </div>
      )}

      {nextSchedulePrompt && (
        <div className="composer-overlay composer-overlay--enter" role="dialog" aria-modal="true">
          <div className="composer-dialog composer-dialog--enter">
            <header className="composer-dialog__header">
              <p className="composer-dialog__title">预约下一次</p>
              <button className="composer-dialog__close pressable" type="button" onClick={handleSkipNextSchedule}>
                ×
              </button>
            </header>
            <div className="composer-form">
              <p className="prompt-text">
                {nextSchedulePrompt.petLabel} 的「{nextSchedulePrompt.actionText}」已完成，是否直接安排下一次提醒？
              </p>
              <label className="composer-field">
                <span>下次提醒日期</span>
                <input
                  type="date"
                  min={todayInput}
                  value={nextScheduleDate}
                  onChange={(event) => setNextScheduleDate(event.target.value)}
                />
              </label>
              <div className="composer-actions composer-actions--spread">
                <button className="composer-secondary pressable" type="button" onClick={handleSkipNextSchedule}>
                  暂不安排
                </button>
                <button className="composer-primary pressable" type="button" onClick={handleConfirmNextSchedule}>
                  预约
                </button>
              </div>
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
                    <span>提醒日期</span>
                    <input
                      type="date"
                      min={todayInput}
                      value={formDate}
                      onChange={(event) => setFormDate(event.target.value)}
                      required
                    />
                  </label>
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
