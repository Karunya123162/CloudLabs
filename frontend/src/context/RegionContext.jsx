import { createContext, useContext, useState } from 'react'

export const REGIONS = [
  { code: 'us-east-1',      name: 'US East (N. Virginia)',       group: 'US East' },
  { code: 'eu-west-1',      name: 'Europe (Ireland)',            group: 'Europe' },
  { code: 'ap-south-1',     name: 'Asia Pacific (Mumbai)',       group: 'Asia Pacific' },
]

const RegionContext = createContext(null)

export function RegionProvider({ children }) {
  const [regionCode, setRegionCode] = useState(
    () => localStorage.getItem('cloudlabs_region') || 'us-east-1'
  )

  const region = REGIONS.find(r => r.code === regionCode) || REGIONS[0]

  const setRegion = (code) => {
    setRegionCode(code)
    localStorage.setItem('cloudlabs_region', code)
  }

  return (
    <RegionContext.Provider value={{ region, setRegion, regions: REGIONS }}>
      {children}
    </RegionContext.Provider>
  )
}

export const useRegion = () => useContext(RegionContext)
