/**
 * Suggest a material code for inline receiving without clashing with material
 * codes already loaded or entered in other rows. The backend checks the
 * current database again before insert; only the database unique constraint
 * is authoritative against simultaneous users.
 *
 * Format MAT-<20 uppercase hex digits>, fits material_code varchar(50).
 */
export function generateMaterialCode(existingCodes = [], makeUuid) {
  const occupied = new Set(existingCodes.map(code=>String(code||'').trim().toUpperCase())
    .filter(Boolean))
  const uuid = makeUuid || (() => {
    if(globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
    // HTTP localhost or older browsers: fallback only as a preview.
    // Backend validates current DB and can create a fresh code itself.
    const digits=()=>Math.floor(Math.random()*0x100000000).toString(16).padStart(8,'0')
    return digits()+digits()+digits()+digits()
  })
  for(let attempt=0;attempt<50;attempt++){
    const raw=String(uuid()).replace(/-/g,'').slice(0,20).toUpperCase()
    if(!/^[A-F0-9]{20}$/.test(raw))continue
    const code='MAT-'+raw
    if(!occupied.has(code))return code
  }
  throw new Error('Không thể tạo mã vật tư không trùng. Vui lòng thử lại.')
}
