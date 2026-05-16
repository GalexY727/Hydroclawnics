import { useEffect, useMemo, useState } from 'react'

const PAGE_SIZE_KEY = 'hydro_per_page'
const SORT_KEY = 'hydro_sort'

function sortPods(pods, sort) {
  const arr = [...pods]
  const statusOrder = { critical: 0, warning: 1, healthy: 2 }
  switch (sort) {
    case 'status':
      return arr.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3))
    case 'crop':
      return arr.sort((a, b) => (a.crop || '').localeCompare(b.crop || ''))
    case 'water_asc':
      return arr.sort((a, b) => (Number(a.water_level) || 100) - (Number(b.water_level) || 100))
    case 'age_newest':
      return arr.sort((a, b) => (Number(b.age_hours) || 0) - (Number(a.age_hours) || 0))
    case 'modified':
      return arr.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    case 'id':
    default:
      return arr.sort((a, b) => (a.id || '').localeCompare(b.id || ''))
  }
}

export default function usePodGrid(pods) {
  const podList = useMemo(() => Object.values(pods), [pods])

  const [statusFilter, setStatusFilter] = useState('all')
  const [cropFilter, setCropFilter] = useState([]) // [] = all crops shown
  const [sort, setSort] = useState(() => localStorage.getItem(SORT_KEY) || 'status')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(() => {
    const saved = localStorage.getItem(PAGE_SIZE_KEY)
    return saved ? Number(saved) : 12
  })

  useEffect(() => { localStorage.setItem(PAGE_SIZE_KEY, String(perPage)) }, [perPage])
  useEffect(() => { localStorage.setItem(SORT_KEY, sort) }, [sort])

  // Reset to page 1 whenever filters/sort/perPage change
  useEffect(() => { setPage(1) }, [statusFilter, cropFilter, sort, perPage])

  const cropTypes = useMemo(
    () => [...new Set(podList.map(p => p.crop).filter(Boolean))].sort(),
    [podList],
  )

  const counts = useMemo(
    () => podList.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1
      return acc
    }, { healthy: 0, warning: 0, critical: 0 }),
    [podList],
  )

  const filtered = useMemo(() => {
    let result = podList
    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter)
    if (cropFilter.length > 0) result = result.filter(p => cropFilter.includes(p.crop))
    return sortPods(result, sort)
  }, [podList, statusFilter, cropFilter, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * perPage, safePage * perPage),
    [filtered, safePage, perPage],
  )

  return {
    paginated,
    total: filtered.length,
    counts,
    cropTypes,
    page: safePage,
    totalPages,
    setPage,
    sort, setSort,
    statusFilter, setStatusFilter,
    cropFilter, setCropFilter,
    perPage, setPerPage,
  }
}
