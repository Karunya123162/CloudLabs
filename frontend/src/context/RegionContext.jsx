import { createContext, useContext, useState } from 'react'

export const REGIONS = [
  { code: 'us-east-1',      name: 'US East (N. Virginia)',       group: 'US East' },
  { code: 'us-east-2',      name: 'US East (Ohio)',              group: 'US East' },
  { code: 'us-west-1',      name: 'US West (N. California)',     group: 'US West' },
  { code: 'us-west-2',      name: 'US West (Oregon)',            group: 'US West' },
  { code: 'ca-central-1',   name: 'Canada (Central)',            group: 'Canada' },
  { code: 'eu-west-1',      name: 'Europe (Ireland)',            group: 'Europe' },
  { code: 'eu-west-2',      name: 'Europe (London)',             group: 'Europe' },
  { code: 'eu-west-3',      name: 'Europe (Paris)',              group: 'Europe' },
  { code: 'eu-central-1',   name: 'Europe (Frankfurt)',          group: 'Europe' },
  { code: 'eu-north-1',     name: 'Europe (Stockholm)',          group: 'Europe' },
  { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)',    group: 'Asia Pacific' },
  { code: 'ap-southeast-2', name: 'Asia Pacific (Sydney)',       group: 'Asia Pacific' },
  { code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)',        group: 'Asia Pacific' },
  { code: 'ap-northeast-2', name: 'Asia Pacific (Seoul)',        group: 'Asia Pacific' },
  { code: 'ap-south-1',     name: 'Asia Pacific (Mumbai)',       group: 'Asia Pacific' },
  { code: 'sa-east-1',      name: 'South America (São Paulo)',   group: 'South America' },
  { code: 'me-south-1',     name: 'Middle East (Bahrain)',       group: 'Middle East' },
  { code: 'af-south-1',     name: 'Africa (Cape Town)',          group: 'Africa' },
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
