const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname)
const masterPath = path.join(ROOT, 'database/seeds/_master_translations_backup.json')
const master = JSON.parse(fs.readFileSync(masterPath, 'utf8'))

function addKey(key, lang, value, source) {
  if (!value || typeof value !== 'string' || value.trim() === '') return
  const trimmed = value.trim()
  if (!master[key]) master[key] = {}
  if (!master[key][lang]) {
    master[key][lang] = []
  } else if (typeof master[key][lang] === 'string') {

    master[key][lang] = [{ value: master[key][lang], source: __PROTECT_23__ }]
  } else if (!Array.isArray(master[key][lang])) {
    master[key][lang] = []
  }
  master[key][lang].push({ value: trimmed, source })
}

addKey(__PROTECT_24__, __PROTECT_25__, __PROTECT_26__, __PROTECT_27__)
addKey(__PROTECT_28__, __PROTECT_29__, __PROTECT_30__, __PROTECT_31__)

addKey(__PROTECT_32__, __PROTECT_33__, __PROTECT_34__, __PROTECT_35__)
addKey(__PROTECT_36__, __PROTECT_37__, __PROTECT_38__, __PROTECT_39__)

addKey(__PROTECT_40__, __PROTECT_41__, __PROTECT_42__, __PROTECT_43__)
addKey(__PROTECT_44__, __PROTECT_45__, __PROTECT_46__, __PROTECT_47__)

addKey(__PROTECT_48__, __PROTECT_49__, __PROTECT_50__, __PROTECT_51__)
addKey(__PROTECT_52__, __PROTECT_53__, __PROTECT_54__, __PROTECT_55__)

addKey(__PROTECT_56__, __PROTECT_57__, __PROTECT_58__, __PROTECT_59__)

addKey(__PROTECT_60__, __PROTECT_61__, __PROTECT_62__, __PROTECT_63__)

addKey(__PROTECT_64__, __PROTECT_65__, __PROTECT_66__, __PROTECT_67__)
addKey(__PROTECT_68__, __PROTECT_69__, __PROTECT_70__, __PROTECT_71__)

addKey(__PROTECT_72__, __PROTECT_73__, __PROTECT_74__, __PROTECT_75__)
addKey(__PROTECT_76__, __PROTECT_77__, __PROTECT_78__, __PROTECT_79__)

addKey(__PROTECT_80__, __PROTECT_81__, __PROTECT_82__, __PROTECT_83__)
addKey(__PROTECT_84__, __PROTECT_85__, __PROTECT_86__, __PROTECT_87__)
addKey(__PROTECT_88__, __PROTECT_89__, __PROTECT_90__, __PROTECT_91__)
addKey(__PROTECT_92__, __PROTECT_93__, __PROTECT_94__, __PROTECT_95__)
addKey(__PROTECT_96__, __PROTECT_97__, __PROTECT_98__, __PROTECT_99__)

addKey(__PROTECT_100__, __PROTECT_101__, __PROTECT_102__, __PROTECT_103__)
addKey(__PROTECT_104__, __PROTECT_105__, __PROTECT_106__, __PROTECT_107__)

addKey(__PROTECT_108__, __PROTECT_109__, __PROTECT_110__, __PROTECT_111__)
addKey(__PROTECT_112__, __PROTECT_113__, __PROTECT_114__, __PROTECT_115__)

}
