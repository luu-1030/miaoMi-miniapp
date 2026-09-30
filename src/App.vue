<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { Cat, House, Heart, BookOpen, ShoppingBag, BriefcaseBusiness, Settings, Bell, Sun, ChevronRight, Plus, PawPrint, Leaf, Fish, Droplets, Sparkles, Brush, Bath, Coffee, Moon, Activity, Tv, Clock3, Check, X, Gift, CalendarDays, ArrowUpRight, Flower2, Shirt, Ribbon, Download, Upload, Package, MessageCircle, Undo2 } from 'lucide-vue-next'
import CatPortrait from './components/CatPortrait.vue'
import CozyRoom from './components/CozyRoom.vue'
import CareerPanel from './components/CareerPanel.vue'
import { useGameStore } from './stores/game'
import { BREEDS, PROFESSIONS, CARE_ACTIONS, ACTIVITIES, SHOP_ITEMS, RANDOM_EVENTS, ENCOUNTER_SOURCES, ADOPTION_PRICE, MAX_CATS, REMINDERS } from './game/data'
import { createGame, getActiveCat, getCatMessage, affectionLabel, careForCat, buyItem, equipOutfit, adoptCat, advanceTime, rollEvent, resolveEvent, maybeEncounter, acceptEncounter, dismissEncounter, startCompanion, finishCompanion, stopCompanion, retrieveCat, serializeGame, deserializeGame, saveGame, type Breed, type Gender, type Profession, type Activity as ActivityId, type CareAction, type ActionResult } from './game/engine'

const store = useGameStore()
const { state, saveError } = storeToRefs(store)
const nav = [
  { id:'home', label:'小咪的家', icon:House }, { id:'companion', label:'陪伴时光', icon:Heart },
  { id:'diary', label:'小咪日记', icon:BookOpen }, { id:'shop', label:'好物小铺', icon:ShoppingBag },
  { id:'career', label:'我的小事业', icon:BriefcaseBusiness }, { id:'settings', label:'生活设置', icon:Settings },
]
const page = ref(nav.some(n=>n.id===location.hash.slice(1)) ? location.hash.slice(1) : 'home')
const pageTitle = computed(()=>nav.find(n=>n.id===page.value)?.label ?? '小咪的家')
function navigate(id:string) { page.value=id; location.hash=id; window.scrollTo({top:0,behavior:'smooth'}) }
const hashChange = ()=> { const id=location.hash.slice(1); if(nav.some(n=>n.id===id)) page.value=id }
const cat = computed(()=>getActiveCat(state.value))
const catName = computed(()=>cat.value?.name ?? '小橘')
const idleMessage = computed(()=>cat.value ? getCatMessage(cat.value) : '想把这份软乎乎的陪伴带回家吗？')
const breedName = (id:string)=>BREEDS.find(b=>b.id===id)?.name ?? '小咪'
const professionName = computed(()=>PROFESSIONS.find(p=>p.id===state.value.profession)?.name)
const now = ref(Date.now())
const dayCount = computed(()=>cat.value ? Math.max(1,Math.floor((now.value-cat.value.joinedAt)/86400000)+1) : 1)
const dateLabel = computed(()=>new Date(now.value).toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'short'}))
const careIcons:Record<string,typeof Heart> = {feed:Fish,water:Droplets,play:Sparkles,brush:Brush,bath:Bath,pet:Heart,snack:Fish}
const activityIcons:Record<string,typeof Heart> = {work:BriefcaseBusiness,sleep:Moon,relax:Coffee,exercise:Activity,watch:Tv}
const shopIcons:Record<string,typeof Heart> = {food:Fish,treat:Fish,ribbon:Ribbon,scarf:Shirt}
const stats = [{key:'food' as const,label:'饱食',icon:Fish,color:'#bac59d'},{key:'water' as const,label:'饮水',icon:Droplets,color:'#a9c1b6'},{key:'cleanliness' as const,label:'清洁',icon:Sparkles,color:'#c5c7a1'},{key:'mood' as const,label:'心情',icon:Sun,color:'#ddc698'}]
type Modal = 'adopt'|'event'|'encounter'|'notifications'|'wardrobe'|null
const modal = ref<Modal>(null)
const adoptForm = ref({catName:'小橘',breed:'orange' as Breed,gender:'female' as Gender,profession:'programmer' as Profession,playerName:''})
const encounterName = ref('')
const reaction = ref('')
const toast = ref<{message:string;error:boolean}|null>(null)
let toastTimeout:ReturnType<typeof setTimeout>|undefined
let reactionTimeout:ReturnType<typeof setTimeout>|undefined
function notify(message:string,error=false){ toast.value={message,error}; clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>toast.value=null,4200) }
function handleResult(result:ActionResult){ notify(result.message,!result.ok); return result.ok }
function bubble(message:string){ reaction.value=message; clearTimeout(reactionTimeout); reactionTimeout=setTimeout(()=>reaction.value='',5500) }
function ensureCat(){ if(!cat.value){modal.value='adopt';return false}return true }
function care(action:CareAction){ if(!ensureCat())return; const result=careForCat(state.value,cat.value!.id,action); handleResult(result);if(result.ok)bubble(result.message) }
function openAdopt(){ if(state.value.cats.length>=MAX_CATS){notify(`家里已经有 ${MAX_CATS} 只小咪啦。`);return}adoptForm.value.catName=state.value.initialized?'小咪':'小橘';modal.value='adopt' }
function confirmAdopt(){ if(!adoptForm.value.catName.trim()){notify('给小咪取一个名字吧。',true);return}
  if(!state.value.initialized){state.value=createGame(adoptForm.value);notify(`${catName.value}到家啦，属于你们的日常开始了。`)}
  else if(!handleResult(adoptCat(state.value,{name:adoptForm.value.catName,breed:adoptForm.value.breed,gender:adoptForm.value.gender,source:'shop'})))return
  modal.value=null; navigate('home');bubble('这个温暖的家，以后就有我啦。')
}
const eventData = computed(()=>RANDOM_EVENTS.find(e=>e.id===state.value.pendingEvent?.eventId))
const encounterData = computed(()=>ENCOUNTER_SOURCES.find(e=>e.id===state.value.pendingEncounter?.sourceId))
function chooseEvent(index:number){ if(!state.value.pendingEvent)return; const result=resolveEvent(state.value,state.value.pendingEvent.id,index);handleResult(result);if(result.ok){modal.value=null;bubble(result.message)} }
function acceptNewCat(){if(handleResult(acceptEncounter(state.value,encounterName.value))){modal.value=null;navigate('home')}}
function declineNewCat(){handleResult(dismissEncounter(state.value));modal.value=null}
function discover(){if(!ensureCat())return; if(state.value.pendingEvent){modal.value='event';return}notify('小插曲会在日常里悄悄发生，先陪小咪待一会儿吧。')}
const selectedActivity = ref<ActivityId>('work')
const duration = ref(5)
const remaining = computed(()=>Math.max(0,Math.ceil(((state.value.companion?.endsAt??now.value)-now.value)/1000)))
const timerText = computed(()=>`${Math.floor(remaining.value/60).toString().padStart(2,'0')}:${(remaining.value%60).toString().padStart(2,'0')}`)
const companionActivity = computed(()=>ACTIVITIES.find(a=>a.id===state.value.companion?.activity))
function beginCompanion(){if(!ensureCat())return;handleResult(startCompanion(state.value,selectedActivity.value,Number(duration.value)))}
const shopFilter = ref('all')
const filteredShop = computed(()=>SHOP_ITEMS.filter(i=>shopFilter.value==='all'||i.category===shopFilter.value))
function purchase(id:string){if(!ensureCat())return;handleResult(buyItem(state.value,id))}
function equip(id:string|null){if(!cat.value)return;handleResult(equipOutfit(state.value,cat.value.id,id))}
const todayEntries = computed(()=>state.value.diary.filter(e=>new Date(e.time).toDateString()===new Date(now.value).toDateString()))
const dailyTasks = computed(()=>[
  {label:'给小咪喂一顿饭',done:todayEntries.value.some(e=>e.kind==='care'&&e.text.includes('喂食')),action:()=>care('feed')},
  {label:'一起度过一段时光',done:todayEntries.value.some(e=>e.kind==='companion'),action:()=>navigate('companion')},
  {label:'完成一份小工作',done:todayEntries.value.some(e=>e.kind==='career'),action:()=>navigate('career')},
])
const formatTime=(time:number)=>new Date(time).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})
const diaryLabels:Record<string,string>={care:'好好照顾你',event:'生活的小插曲',adoption:'一段新的缘分',career:'认真生活的小奖励',companion:'有你陪着的时光',system:'家的小小记录'}
const reminderInterval=computed({get:()=>state.value.reminderMinutes,set:(value:number)=>state.value.reminderMinutes=value})
const reminderVisible=ref(false)
const reminderIndex=ref(0)
const reminderData=computed(()=>REMINDERS[reminderIndex.value%REMINDERS.length]!)
let nextReminder=Date.now()+reminderInterval.value*60000
watch(reminderInterval,()=>nextReminder=Date.now()+reminderInterval.value*60000)
function dismissReminder(){reminderVisible.value=false;nextReminder=Date.now()+reminderInterval.value*60000;reminderIndex.value++}
function exportSave(){const url=URL.createObjectURL(new Blob([serializeGame(state.value)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`miaomi-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url);notify('这段小小日常已经打包保存。')}
async function importSave(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{if(file.size>300000)throw new Error('文件过大');const restored=deserializeGame(await file.text());if(!restored)throw new Error('格式错误');advanceTime(restored,Date.now(),{offline:true});state.value=restored;notify('欢迎回家，进度恢复好啦。')}catch{notify('这个文件不是有效的小咪存档，请检查后重试。',true)}input.value=''}
let previousFocus:HTMLElement|null=null
const modalElement=ref<HTMLElement|null>(null)
watch(modal,async(value,old)=>{document.body.style.overflow=value?'hidden':'';if(value&&!old)previousFocus=document.activeElement as HTMLElement;await nextTick();if(value)modalElement.value?.querySelector<HTMLElement>('button,input,select')?.focus();else previousFocus?.focus()})
function modalKeys(event:KeyboardEvent){if(event.key==='Escape'){modal.value=null;return}if(event.key!=='Tab')return;const items=modalElement.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]');if(!items?.length)return;const first=items[0]!,last=items[items.length-1]!;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
let interval:ReturnType<typeof setInterval>
let tick=0
function persist(){saveGame(state.value,localStorage)}
function visibilityChange(){if(document.hidden){persist();return}now.value=Date.now();advanceTime(state.value,now.value,{offline:true})}
onMounted(()=>{window.addEventListener('hashchange',hashChange);window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',visibilityChange);interval=setInterval(()=>{
  now.value=Date.now();tick++
  if(!state.value.initialized||document.hidden)return
  if(state.value.companion&&now.value>=state.value.companion.endsAt)handleResult(finishCompanion(state.value,now.value))
  if(tick%15===0){advanceTime(state.value,now.value);rollEvent(state.value,now.value);maybeEncounter(state.value,now.value)}
  if(tick%65===0&&cat.value&&cat.value.status==='home')bubble(getCatMessage(cat.value,state.value.companion?'companion':'idle'))
  if(state.value.remindersEnabled&&now.value>=nextReminder&&!reminderVisible.value){reminderVisible.value=true;nextReminder=now.value+reminderInterval.value*60000}
},1000)})
onUnmounted(()=>{clearInterval(interval);clearTimeout(toastTimeout);clearTimeout(reactionTimeout);window.removeEventListener('hashchange',hashChange);window.removeEventListener('pagehide',persist);document.removeEventListener('visibilitychange',visibilityChange)})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <a href="#home" class="brand" @click="navigate('home')"><div class="brand-icon"><Cat :size="29" :stroke-width="1.7" /></div><div><h1>小咪小咪</h1><p>miaoMi</p></div></a>
      <p class="sidebar-caption">MY LITTLE WORLD</p>
      <nav class="nav-list" aria-label="主导航"><button v-for="item in nav" :key="item.id" class="nav-item" :class="{active:page===item.id}" :aria-current="page===item.id?'page':undefined" @click="navigate(item.id)"><component :is="item.icon" :size="19" :stroke-width="1.65"/><span>{{item.label}}</span><span v-if="page===item.id" class="nav-dot">●</span></button></nav>
      <div class="sidebar-note"><Flower2 :size="38" :stroke-width="1"/><p>日子慢慢过，<br>小咪陪着你。</p><span>A LITTLE LOVE, EVERY DAY</span></div>
      <div class="sidebar-user"><div class="user-avatar"><PawPrint :size="19" :stroke-width="1.5"/></div><div><strong>{{state.playerName}}</strong><p>{{professionName}} · 温柔生活中</p></div><button aria-label="打开设置" @click="navigate('settings')"><Settings :size="15"/></button></div>
    </aside>
    <main class="main-area">
      <header class="topbar"><div class="breadcrumb"><span>我的小世界</span><ChevronRight :size="12"/><strong>{{pageTitle}}</strong></div><a href="#home" class="mobile-brand"><Cat :size="25"/>小咪小咪 <small>miaoMi</small></a><div class="topbar-actions"><span class="weather"><Sun :size="15"/>{{dateLabel}}</span><div class="coins" title="游戏金币"><span class="coin-icon">✦</span>{{state.coins}}<span style="font-size:10px;font-weight:400">金币</span></div><button class="icon-button" aria-label="消息与提醒" @click="modal='notifications'"><Bell :size="18" :stroke-width="1.5"/><span v-if="state.pendingEvent||state.pendingEncounter" class="notification-dot"></span></button><button class="icon-button" aria-label="生活设置" @click="navigate('settings')"><Settings :size="18" :stroke-width="1.5"/></button></div></header>
      <div class="page">
        <template v-if="page==='home'">
          <div class="welcome-row"><div><div class="eyebrow">HOME IS WHERE MY CAT IS</div><h2>嗨，今天也要开心呀 <span>☀</span></h2><p>{{state.initialized?`这是你和 ${catName} 相伴的第 ${dayCount} 天，平凡的日子也在闪闪发光。`:'把平凡的日子，过成有猫的日子。你的小小伙伴正在等你。'}}</p></div><button class="outline-button" @click="openAdopt"><Plus :size="14"/>{{state.initialized?'迎接新小咪':'领养第一只小咪'}}</button></div>
          <div v-if="state.cats.length>1" class="cat-family"><button v-for="item in state.cats" :key="item.id" :class="{active:cat?.id===item.id}" @click="state.activeCatId=item.id"><PawPrint :size="13"/>{{item.name}}<span v-if="item.status==='away'"> · 外出中</span></button></div>
          <div v-if="cat?.status==='away'" class="lost-cat"><p>{{catName}}出去散散心了。带上它熟悉的毯子，去找找这个小家伙吧。</p><button class="primary-button" @click="handleResult(retrieveCat(state,cat.id))"><Heart :size="15"/>接小咪回家</button></div>
          <div class="home-grid"><section class="room-panel" aria-label="小咪的温暖小屋"><div class="room-intro"><span class="mini-label"><Leaf :size="10"/> OUR COZY LITTLE HOME</span><h3>一屋，两人，<br>三餐，四季。</h3><p>还有一只，满心是你的小咪。</p></div><CozyRoom :breed="cat?.breed??'orange'" :name="catName" :sleeping="!!state.companion" :accessory="cat?.outfit??''" :second-breed="state.cats.find(c=>c.id!==cat?.id&&c.status==='home')?.breed" :reaction="reaction" :away="cat?.status==='away'" @pet="care('pet')"/><div class="room-footer"><span><PawPrint :size="13"/>{{idleMessage}}</span><button @click="modal=cat?'wardrobe':'adopt'">{{cat?'给小咪换装':'接它回家'}}<ChevronRight :size="12"/></button></div></section>
            <section class="card cat-status"><div class="card-heading"><h3>我的小咪 <PawPrint :size="14"/></h3><span class="tiny-tag">{{cat?'在家的第 '+dayCount+' 天':'初次见面'}}</span></div><div class="cat-profile"><div class="cat-avatar"><CatPortrait :breed="cat?.breed??'orange'"/></div><div><h4>{{catName}}<span class="gender">{{cat?.gender==='male'?'♂':'♀'}}</span></h4><p>{{breedName(cat?.breed??'orange')}} · {{cat?'性格等你慢慢发现':'等一个温暖的家'}}</p></div></div><div class="affection-box"><div class="affection-title"><span><Heart :size="12"/>亲密度</span><strong>{{Math.round(cat?.affection??55)}} <small>/ 100</small></strong></div><div class="progress-track"><div class="progress-fill" :style="{width:(cat?.affection??55)+'%'}"></div></div><p>{{cat?affectionLabel(cat.affection):'故事，从一次相遇开始'}}</p></div><div v-for="stat in stats" :key="stat.key" class="stat-row"><component :is="stat.icon" :size="12"/><span>{{stat.label}}</span><div class="progress-track" role="progressbar" :aria-label="stat.label" :aria-valuenow="Math.round(cat?.[stat.key]??75)" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" :style="{width:(cat?.[stat.key]??75)+'%',background:stat.color}"></div></div><span class="stat-value">{{Math.round(cat?.[stat.key]??75)}}</span></div><p class="status-caption"><Heart :size="11"/>{{cat?'一点一滴的照顾，小咪都记得。':'领养后，开始你们的小小日常。'}}</p></section>
          </div>
          <section><div class="section-row"><h3 class="section-title"><Heart :size="16"/>把喜欢，藏进小事里 <span class="section-note">照顾小咪，也治愈自己</span></h3><button class="text-button" @click="modal=cat?'wardrobe':'adopt'"><Package :size="12"/>我的背包<ChevronRight :size="12"/></button></div><div class="care-grid"><button v-for="item in CARE_ACTIONS.slice(0,6)" :key="item.id" class="care-button" @click="care(item.id)"><span class="care-icon"><component :is="careIcons[item.id]" :size="24" :stroke-width="1.5"/></span><strong>{{item.name}}</strong><small>{{item.id==='feed'?`猫粮剩余 ${state.inventory.food} 份`:item.id==='water'?'水碗满满，爱也满满':item.id==='play'?'收集一点小快乐':item.id==='brush'?'顺顺毛，顺顺心':item.id==='bath'?'变成香香的小咪':'把温柔给你'}}</small></button></div></section>
          <div class="bottom-grid"><section class="card companion-preview"><div class="card-heading"><h3><Coffee :size="15"/>一起待一会儿</h3></div><p>工作、发呆，或是什么都不做。<br>有小咪陪着，就很好。</p><button class="primary-button" @click="navigate('companion')">{{state.companion?'陪伴进行中 '+timerText:'开启陪伴时光'}}<ArrowUpRight :size="12"/></button><div class="companion-art"><CatPortrait :breed="cat?.breed??'orange'" sleeping/></div></section>
            <section class="card"><div class="card-heading"><h3><BookOpen :size="15"/>小咪日记</h3><button class="text-button" @click="navigate('diary')">翻一翻<ChevronRight :size="12"/></button></div><div class="diary-peek"><div class="diary-marker"></div><div><p>{{state.diary[0]?.text??'还没有写下的故事，正等着你和小咪一起发生。'}}</p><small>{{state.diary[0]?formatTime(state.diary[0].time):'属于你们的第一页'}}</small></div></div></section>
            <section class="card daily-card"><div class="card-heading"><h3><Sun :size="15"/>今日小确幸</h3><span class="tiny-tag">{{dailyTasks.filter(t=>t.done).length}} / 3</span></div><button v-for="task in dailyTasks" :key="task.label" class="daily-task" @click="task.action"><span class="task-circle" :class="{done:task.done}"><Check v-if="task.done" :size="10"/></span><span>{{task.label}}</span><span class="task-reward">{{task.done?'已完成':'去完成 ›'}}</span></button></section></div>
          <div v-if="state.pendingEncounter" class="floating-note"><span><Gift :size="16"/>{{encounterData?.title}}，要去看看吗？</span><button class="text-button" @click="modal='encounter'">看看新朋友<ChevronRight :size="12"/></button></div>
          <div v-else class="floating-note"><span><MessageCircle :size="15"/>{{state.pendingEvent?`${eventData?.title}，小咪有话想对你说。`:'每只小咪都有自己的小脾气，慢慢相处，你会读懂它的喜欢。'}}</span><button class="text-button" @click="discover">{{state.pendingEvent?'回应小咪':'静候小插曲'}}<ChevronRight :size="12"/></button></div>
        </template>

        <template v-else-if="page==='companion'"><div class="welcome-row"><div><div class="eyebrow">BETTER TOGETHER</div><h2>陪你，把日子过慢一点</h2><p>不必时刻说话，在一起就足够了。</p></div><Heart :size="28" color="#aabb96" :stroke-width="1.3"/></div><div v-if="state.companion" class="card timer-card"><div style="width:115px;height:110px;margin:0 auto"><CatPortrait :breed="state.cats.find(c=>c.id===state.companion?.catId)?.breed" sleeping/></div><h3>{{companionActivity?.name}}，有小咪在身旁</h3><div class="timer-display" aria-live="off">{{timerText}}</div><p>{{cat?getCatMessage(cat,'companion'):''}}</p><button class="outline-button" style="margin-top:23px" @click="handleResult(stopCompanion(state))">结束这次陪伴</button></div><template v-else><div class="activity-grid"><button v-for="item in ACTIVITIES" :key="item.id" class="activity-card" :class="{selected:selectedActivity===item.id}" :aria-pressed="selectedActivity===item.id" @click="selectedActivity=item.id"><component :is="activityIcons[item.id]" :size="29" :stroke-width="1.3"/><h3>{{item.name}}</h3><p>{{item.description}}</p></button></div><div class="card companion-controls"><Clock3 :size="20" color="#96a580"/><label for="duration">留一段时间给彼此</label><select id="duration" v-model="duration"><option :value="1">1 分钟 · 小憩</option><option :value="5">5 分钟</option><option :value="15">15 分钟</option><option :value="25">25 分钟 · 专注</option><option :value="60">60 分钟</option></select><button class="primary-button" @click="beginCompanion">和{{catName}}一起开始<ArrowUpRight :size="15"/></button></div><p class="page-subtitle" style="margin-top:17px">完成后，亲密度 +4、心情 +8。提前结束也没关系，小咪会等你回来。</p></template></template>

        <template v-else-if="page==='diary'"><div class="welcome-row"><div><div class="eyebrow">OUR LITTLE MEMORIES</div><h2>把温柔，一页页收藏</h2><p>那些关于你和小咪的小事，都值得被记住。</p></div><BookOpen :size="27" color="#aabb96" :stroke-width="1.3"/></div><div v-if="!state.diary.length" class="card empty-panel"><BookOpen :size="42" color="#acb996" :stroke-width="1.2"/><h3>故事的第一页，留给相遇</h3><p>接一只小咪回家吧。<br>它的每一次靠近，都会成为这里的一行日记。</p><button class="primary-button" @click="openAdopt">去见见我的小咪</button></div><div class="diary-list"><article v-for="entry in state.diary" :key="entry.id" class="card diary-entry"><div class="diary-entry-icon"><component :is="entry.kind==='adoption'?PawPrint:entry.kind==='career'?BriefcaseBusiness:entry.kind==='companion'?Heart:Leaf" :size="20" :stroke-width="1.5"/></div><div><h3>{{diaryLabels[entry.kind]}}</h3><p>{{entry.text}}</p><time :datetime="new Date(entry.time).toISOString()">{{formatTime(entry.time)}}</time></div></article></div></template>

        <template v-else-if="page==='shop'"><div class="welcome-row"><div><div class="eyebrow">LITTLE THINGS, LOTS OF LOVE</div><h2>给小咪，刚刚好的喜欢</h2><p>一份零食，一件新衣，都是藏不住的偏爱。</p></div><button class="outline-button" @click="modal=cat?'wardrobe':'adopt'"><Package :size="15"/>我的背包</button></div><div class="filter-tabs"><button v-for="filter in [{id:'all',name:'全部好物'},{id:'food',name:'好好吃饭'},{id:'outfit',name:'可爱穿搭'}]" :key="filter.id" :class="{active:shopFilter===filter.id}" @click="shopFilter=filter.id">{{filter.name}}</button></div><div class="shop-grid"><article v-for="item in filteredShop" :key="item.id" class="card shop-card"><div class="shop-art" :style="{background:item.color+'40',color:item.color}"><component :is="shopIcons[item.id]"/></div><h3>{{item.name}} <small style="font-size:10px;color:#aab199;font-weight:400">×{{item.quantity}}</small></h3><p>{{item.subtitle}}<br>背包里还有 {{state.inventory[item.id]??0}} {{item.category==='food'?'份':'件'}}</p><div class="shop-card-footer"><span class="price"><span class="coin-icon">✦</span>{{item.price}}</span><button class="primary-button small-button" :disabled="item.category==='outfit'&&state.inventory[item.id]>0" @click="purchase(item.id)">{{item.category==='outfit'&&state.inventory[item.id]>0?'已在衣橱':'带回家'}}</button></div></article><article v-if="shopFilter==='all'" class="card shop-card"><div class="shop-art" style="background:#edf0e3"><Cat :size="48"/></div><h3>一位新的家庭成员</h3><p>挑选心仪的品种与性别，<br>让相处慢慢告诉你它的性格。</p><div class="shop-card-footer"><span class="price"><span class="coin-icon">✦</span>{{state.initialized?ADOPTION_PRICE:'免费'}}</span><button class="primary-button small-button" @click="openAdopt">去见见它</button></div></article></div></template>

        <template v-else-if="page==='career'"><div class="welcome-row"><div><div class="eyebrow">MAKE A LITTLE, LOVE A LOT</div><h2>认真生活，也认真爱咪</h2><p>做一点喜欢的事，为小咪攒一份小小的幸福。</p></div><BriefcaseBusiness :size="27" color="#aabb96" :stroke-width="1.3"/></div><div v-if="!state.initialized" class="card empty-panel"><Cat :size="42" color="#a2b58b"/><h3>先认识你的小小伙伴</h3><p>领养小咪时选择职业，之后也可以随时切换体验。</p><button class="primary-button" @click="openAdopt">接小咪回家</button></div><CareerPanel v-else :state="state" @notify="notify"/></template>

        <template v-else-if="page==='settings'"><div class="welcome-row"><div><div class="eyebrow">A RHYTHM OF YOUR OWN</div><h2>找到自己的生活节奏</h2><p>让小咪的陪伴，成为舒服又刚好的存在。</p></div></div><section class="card settings-card"><div class="card-heading"><h3><Bell :size="17"/>温柔提醒</h3></div><div class="settings-row"><div><strong>来自小咪的关心</strong><p>喝水、活动肩颈、看看远处。仅在页面打开时提醒。</p></div><button class="toggle" :class="{on:state.remindersEnabled}" role="switch" :aria-checked="state.remindersEnabled" aria-label="开启健康提醒" @click="state.remindersEnabled=!state.remindersEnabled;reminderVisible=false"></button></div><div class="settings-row"><div><strong>提醒频率</strong><p>给自己留一点休息的间隙。</p></div><select v-model="reminderInterval" aria-label="提醒频率"><option :value="15">每 15 分钟</option><option :value="30">每 30 分钟</option><option :value="60">每 60 分钟</option></select></div><div class="settings-row"><div><strong>看看小咪会说什么</strong><p>先试一次，找到喜欢的陪伴方式。</p></div><button class="outline-button small-button" @click="reminderVisible=true">试试提醒</button></div></section><section class="card settings-card"><div class="card-heading"><h3><Heart :size="17"/>我的小小档案</h3></div><div class="settings-row"><div><strong>怎么称呼你</strong><p>你是小咪最特别的朋友。</p></div><input v-model="state.playerName" maxlength="20" aria-label="玩家昵称" style="width:160px"/></div><div class="settings-row"><div><strong>收藏我们的日常</strong><p>{{saveError?'浏览器存储空间不足，请导出备份。':'进度自动保存在当前浏览器，换设备前可导出备份。'}}</p></div><button class="outline-button small-button" @click="exportSave"><Download :size="13"/>导出存档</button></div><div class="settings-row"><div><strong>带小咪搬个家</strong><p>导入会替换当前进度，请先导出当前存档。</p></div><label class="outline-button small-button import-label"><Upload :size="13"/>导入存档<input type="file" accept="application/json,.json" class="sr-only" @change="importSave"/></label></div></section><div class="notice-card"><strong>小咪小咪 · miaoMi</strong><br>这是属于你和小咪的生活小角落。没有必须完成的排名，也不用时刻在线。<br>Web 体验版 v0.1 · 本地存档 · 温柔相伴</div></template>
        <footer class="page-footer"><span></span><PawPrint :size="11"/> 你的小小日常，有咪陪伴 <span></span></footer>
      </div>
    </main>
    <div v-if="modal" class="modal-backdrop" @click.self="modal=null" @keydown="modalKeys"><section ref="modalElement" class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close" aria-label="关闭弹窗" @click="modal=null"><X :size="18"/></button>
      <template v-if="modal==='adopt'"><div class="modal-cat"><CatPortrait :breed="adoptForm.breed"/></div><h2 id="modal-title">{{state.initialized?'家里，还可以多一点温柔':'你好，我的小小伙伴'}}</h2><p class="modal-description">{{state.initialized?`带一只新小咪回家 · ${ADOPTION_PRICE} 金币`:'领养你的第一只小咪，一起开启暖乎乎的日常。'}}<br>它的小脾气，留给你们在相处中慢慢发现。</p><form @submit.prevent="confirmAdopt"><label class="form-field"><span>给小咪取个名字</span><input v-model="adoptForm.catName" maxlength="12" required placeholder="比如：小橘、糯米、奶糖"/></label><div class="form-field"><span>想与哪只小咪相遇</span><div class="breed-options"><button v-for="breed in BREEDS" :key="breed.id" type="button" :class="{selected:adoptForm.breed===breed.id}" @click="adoptForm.breed=breed.id">{{breed.name}}</button></div></div><div class="form-grid"><label class="form-field"><span>小咪的性别</span><select v-model="adoptForm.gender"><option value="female">小女生 ♀</option><option value="male">小男生 ♂</option></select></label><label v-if="!state.initialized" class="form-field"><span>你的小事业</span><select v-model="adoptForm.profession"><option v-for="job in PROFESSIONS" :key="job.id" :value="job.id">{{job.name}}</option></select></label></div><label v-if="!state.initialized" class="form-field"><span>小咪该怎么称呼你（选填）</span><input v-model="adoptForm.playerName" maxlength="20" placeholder="小咪的朋友"/></label><button class="primary-button full-button" type="submit"><Heart :size="16"/>{{state.initialized?`带它回家 · ${ADOPTION_PRICE} 金币`:'接小咪回家'}}</button></form></template>
      <template v-else-if="modal==='event'&&eventData"><div class="event-illustration"><MessageCircle :size="42" :stroke-width="1.1"/></div><h2 id="modal-title">{{eventData.title}}</h2><p class="modal-description">{{eventData.text}}</p><div class="event-choices"><button v-for="(choice,index) in eventData.choices" :key="index" @click="chooseEvent(index)">{{choice.text}} <ChevronRight :size="12" style="float:right"/></button></div></template>
      <template v-else-if="modal==='encounter'&&state.pendingEncounter"><div class="modal-cat"><CatPortrait :breed="state.pendingEncounter.breed"/></div><h2 id="modal-title">{{encounterData?.title}}</h2><p class="modal-description">{{encounterData?.text}}<br>{{breedName(state.pendingEncounter.breed)}} · {{state.pendingEncounter.gender==='female'?'小女生':'小男生'}} · {{encounterData?.price ? encounterData.price+' 游戏金币' : '免费领养'}}</p><label class="form-field"><span>如果带它回家，想叫它什么呢</span><input v-model="encounterName" maxlength="12" placeholder="给新朋友一个名字"/></label><button class="primary-button full-button" @click="acceptNewCat"><Heart :size="15"/>欢迎成为这个家的一员</button><button class="text-button" style="margin-top:14px;width:100%;justify-content:center" @click="declineNewCat">现在还没有准备好，温柔地告别</button></template>
      <template v-else-if="modal==='notifications'"><h2 id="modal-title">来自小咪的小纸条</h2><p class="modal-description">日常里的小小消息，都收在这里。</p><div class="notification-list"><p v-if="!state.initialized">你的第一只小咪正在等你，去认识一下它吧。</p><p v-else-if="!state.pendingEvent&&!state.pendingEncounter">家里一切都好。小咪说：记得好好吃饭，也记得想我。</p><button v-if="state.pendingEvent" class="outline-button" @click="modal='event'">{{eventData?.title}}<ChevronRight :size="14"/></button><button v-if="state.pendingEncounter" class="outline-button" @click="modal='encounter'">{{encounterData?.title}}<ChevronRight :size="14"/></button><p>温柔提醒{{state.remindersEnabled?'已开启':'已关闭'}}。喝水、放松、看看远处，小咪也会照顾你。</p><button class="text-button" @click="modal=null;navigate('settings')">调整提醒设置<ChevronRight :size="13"/></button></div></template>
      <template v-else-if="modal==='wardrobe'"><h2 id="modal-title">小咪的百宝袋</h2><p class="modal-description">把小小的偏爱，都装进来。</p><div class="modal-cat"><CatPortrait :breed="cat?.breed" :accessory="cat?.outfit??''"/></div><div class="settings-row"><div><strong>元气猫粮 · {{state.inventory.food}} 份</strong><p>好好吃饭，才有力气撒娇。</p></div><button class="outline-button small-button" @click="care('feed')">喂一份</button></div><div class="settings-row"><div><strong>香香小鱼干 · {{state.inventory.treat}} 份</strong><p>奖励今天可爱的你。</p></div><button class="outline-button small-button" @click="care('snack')">给点零食</button></div><div v-for="item in SHOP_ITEMS.filter(i=>i.category==='outfit')" :key="item.id" class="settings-row"><div><strong>{{item.name}}</strong><p>{{state.inventory[item.id]>0?'已在衣橱里':'去好物小铺带回来吧'}}</p></div><button class="outline-button small-button" :disabled="!state.inventory[item.id]" @click="equip(cat?.outfit===item.id?null:item.id)">{{cat?.outfit===item.id?'取下':'穿戴'}}</button></div><button class="primary-button full-button" @click="modal=null;navigate('shop')"><ShoppingBag :size="15"/>逛逛好物小铺</button></template>
    </section></div>
    <aside v-if="reminderVisible" class="reminder-bubble" role="status"><h3><Coffee :size="17"/>{{reminderData.title}}</h3><p>{{reminderData.text}}</p><button class="primary-button small-button" @click="dismissReminder">好呀，一起休息</button><button class="text-button" @click="dismissReminder">稍后再说</button></aside>
    <div class="toast-stack" aria-live="polite"><Transition name="toast"><div v-if="toast" :key="toast.message" class="toast" :class="{error:toast.error}">{{toast.message}}</div></Transition></div>
  </div>
</template>
