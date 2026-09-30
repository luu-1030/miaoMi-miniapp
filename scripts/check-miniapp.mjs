import { readdir, readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'

const project = resolve(import.meta.dirname, '../apps/miniapp')
const manifest = JSON.parse(await readFile(resolve(project, 'manifest.json'), 'utf8'))
const pages = JSON.parse(await readFile(resolve(project, 'pages.json'), 'utf8'))
if (!Object.hasOwn(manifest, 'uni-app-x')) throw new Error('The uni-app-x project marker is required.')
for (const page of pages.pages) await readFile(resolve(project, `${page.path}.uvue`))
const files = []
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['unpackage', 'node_modules', 'uniCloud-aliyun', '.hbuilderx'].includes(entry.name)) continue
    const file = resolve(directory, entry.name)
    if (entry.isDirectory()) await visit(file)
    else if (entry.name.endsWith('.uvue')) files.push(file)
  }
}
await visit(project)
for (const [index, file] of files.entries()) {
  const source = (await readFile(file, 'utf8')).replace(/lang="uts"/g, 'lang="ts"')
  const { descriptor, errors } = parse(source, { filename: file })
  if (errors.length) throw new Error(`${file}: ${errors.join(', ')}`)
  const script = compileScript(descriptor, { id: `mini-${index}` })
  if (descriptor.template) {
    const result = compileTemplate({
      source: descriptor.template.content, filename: file, id: `mini-${index}`,
      compilerOptions: { bindingMetadata: script.bindings },
    })
    if (result.errors.length) throw new Error(`${file}: ${result.errors.join(', ')}`)
  }
  for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    await readFile(resolve(dirname(file), match[1]))
  }
}
console.log(`PASS: ${files.length} uni-app x SFC syntax checks, local imports, page paths and manifest. HBuilderX/WeChat compilation is still required.`)
