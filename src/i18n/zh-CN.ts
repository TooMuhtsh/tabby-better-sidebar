/**
 * Simplified Chinese table — keys are the English source strings used in the code.
 * See fr-FR.ts for how these tables are kept in step with the code.
 *
 * Contributed by hoyoho (github.com/hoyoho/tabby-better-sidebar, locale/zh-CN.po,
 * 2026-09-12), converted to this plugin's table format. Plurals only carry the
 * `other` category: Chinese has no grammatical number.
 */
const zh_CN: Record<string, string> = {
    // sftpPanel.component.ts — header line, auto-return-to-Profiles notices
    'SSH session lost ({tab}) — back to Profiles view': 'SSH 会话已断开（{tab}）——返回配置视图',
    'SSH session lost — back to Profiles view': 'SSH 会话已断开——返回配置视图',
    'No more active SSH session — back to Profiles view': '没有活动的 SSH 会话了——返回配置视图',

    // sftpPanel.component.pug — freeze toggle, waiting placeholder
    'Frozen view — click to follow focus again': '视图已冻结——点击以重新跟随焦点',
    'Freeze view on this session': '在此会话上冻结视图',
    'Waiting for an active SSH session.': '正在等待活动的 SSH 会话。',
    'Open an SSH profile — the panel will follow the selected tab.': '打开一个 SSH 配置——面板会跟随选中的标签页。',

    // sftpBrowser.component.ts — availableColumns / displayToggles
    'Size': '大小',
    'File size': '文件大小',
    'Date': '日期',
    'Date modified': '修改日期',
    'Perm.': '权限',
    'Permissions in octal (755)': '八进制权限（755）',
    'Rights': '权限',
    'Permissions in long form (drwxr-xr-x)': '长格式权限（drwxr-xr-x）',
    'Type': '类型',
    'Item type': '项目类型',
    'Ext.': '扩展名',
    'File extension': '文件扩展名',
    'Folders first': '文件夹优先',
    'Show hidden files': '显示隐藏文件',
    'Column borders': '列边框',
    'Alternating rows': '隔行变色',

    // sftpBrowser.component.ts — downloadFolder()
    'Destination folder for {name}': '{name} 的目标文件夹',
    'Download here': '下载到此处',
    '{name} downloaded to {base}': '{name} 已下载到 {base}',
    '{name}: incomplete download': '{name}：下载不完整',

    // sftpBrowser.component.ts — createFileFromMenu()
    'New file name': '新文件名',
    'The name cannot contain "/"': '名称不能包含“/”',
    '{name} already exists': '{name} 已存在',
    'Could not create {name}': '无法创建 {name}',

    // sftpBrowser.component.ts — openEntry()
    'Could not follow the link {name}': '无法跟随链接 {name}',
    '{name} points to a target that cannot be found': '{name} 指向的目标不存在',
    '{name} → {target}': '{name} → {target}',

    // sftpBrowser.component.ts — confirmHeavyDirectory()
    'Could not read the contents of {name}': '无法读取 {name} 的内容',
    '"{name}" contains more than {count} files ({size} at least). Everything will be downloaded before drag-and-drop becomes possible, with no progress and no way to cancel. Continue?':
        '“{name}”包含超过 {count} 个文件（至少 {size}）。全部下载完成后才能拖放，过程中没有进度也无法取消。是否继续？',
    'Download': '下载',

    // sftpBrowser.component.ts — receiveDrop() / resolveDestination()
    'Could not read what was dropped': '无法读取拖入的内容',
    '{name} is not a folder — nothing was moved': '{name} 不是文件夹——未移动任何内容',
    '{name} is not a folder — sending to {path}': '{name} 不是文件夹——正在发送到 {path}',

    // sftpBrowser.component.ts — confirmOverwrite()
    '{names}, and {rest, plural, one {# more} other {# more}}': '{names}，以及另外 {rest, plural, other {# 项}}',
    '{count} files already exist under {destination} and will be overwritten: {list}. Continue?':
        '{destination} 下已存在 {count} 个文件，将被覆盖：{list}。是否继续？',
    'A file already exists under {destination} and will be overwritten: {list}. Continue?':
        '{destination} 下已存在一个文件，将被覆盖：{list}。是否继续？',
    'Overwrite': '覆盖',

    // sftpBrowser.component.ts — reportDrop()
    // Only the `other` branch: Chinese does not inflect for number.
    '{sent, plural, one {# file} other {# files}} sent to {destination} ({folders, plural, one {# folder} other {# folders}})':
        '{sent, plural, other {# 个文件}}已发送到 {destination}（{folders, plural, other {# 个文件夹}}）',
    '{sent, plural, one {# file} other {# files}} sent to {destination}':
        '{sent, plural, other {# 个文件}}已发送到 {destination}',
    '{folders, plural, one {# folder} other {# folders}} created in {destination}':
        '已在 {destination} 创建 {folders, plural, other {# 个文件夹}}',
    'Could not send {failed, plural, one {# file} other {# files}} of {total}':
        '无法发送 {total} 个文件中的 {failed, plural, other {# 个}}',

    // sftpBrowser.component.ts — askedToLeave()
    'Dragging folders out is disabled — enable it in Settings → Better Sidebar':
        '已禁用向外拖拽文件夹——可在 设置 → Better Sidebar 中启用',

    // sftpBrowser.component.ts — receiveMove()
    '{name} cannot be moved into itself': '{name} 不能移动到自身',
    '{name} already exists in {destination}': '{name} 在 {destination} 中已存在',
    'Could not move {name}: {error}': '无法移动 {name}：{error}',
    '{name} moved to {destination}': '{name} 已移动到 {destination}',
    'Could not move {name} to {destination}': '无法将 {name} 移动到 {destination}',
    '{count} items moved to {destination}': '已将 {count} 项移动到 {destination}',
    'No move succeeded': '没有移动成功',
    '{succeeded} moved, {failed} failed': '成功 {succeeded} 项，失败 {failed} 项',

    // sftpBrowser.component.ts — showContextMenu()
    'Open with...': '打开方式…',
    'Rename...': '重命名…',
    'Delete': '删除',
    'Delete selection ({count})': '删除所选（{count}）',

    // sftpBrowser.component.ts — renameEntry()
    'New name for "{name}"': '为“{name}”输入新名称',
    'The name cannot contain "/" — this renames, it does not move': '名称不能包含“/”——这里只是重命名，不是移动',
    '{name} already exists in this folder': '{name} 已在此文件夹中存在',
    'Could not rename {name}': '无法重命名 {name}',
    '{old} renamed to {new}': '{old} 已重命名为 {new}',

    // sftpBrowser.component.ts — delete confirmations (single + bulk)
    'Delete folder "{name}" and everything in it?': '删除文件夹“{name}”及其中的所有内容？',
    'Confirm deletion of "{name}"?': '确认删除“{name}”？',
    '{name} deleted': '{name} 已删除',
    'Could not delete {name}': '无法删除 {name}',
    'Delete {count} items? This action is irreversible.': '删除 {count} 项？此操作不可撤销。',
    '{name}: {error}': '{name}：{error}',
    '{count} items deleted': '已删除 {count} 项',
    '{succeeded} deleted, {failed} failed': '成功删除 {succeeded} 项，失败 {failed} 项',

    // sftpBrowser.component.ts — typeLabel() / rowTooltip()
    'Link': '链接',
    'Folder': '文件夹',
    'File': '文件',
    'Size: {size} ({bytes} bytes)': '大小：{size}（{bytes} 字节）',
    'Modified: {date}': '修改时间：{date}',
    'Permissions: {octal} — {long}': '权限：{octal} — {long}',
    'Type: {type}': '类型：{type}',
    'Symbolic link': '符号链接',

    // sftpBrowser.component.pug — toolbar
    'Double-click to type a path': '双击以输入路径',
    'Type the path by hand': '手动输入路径',
    'Refresh': '刷新',
    'Filter the list': '过滤列表',
    'New remote folder': '新建远程文件夹',
    'Send files to the server': '发送文件到服务器',
    'Send a folder to the server': '发送文件夹到服务器',
    'Filter...': '过滤…',
    'Clear the filter': '清除过滤',

    // sftpBrowser.component.pug — body, grid, sentinel
    'Connecting...': '正在连接…',
    'Loading...': '正在加载…',
    'Name': '名称',
    'Go up one level': '返回上一级',
    '… {n} more items': '… 还有 {n} 项',
    'No file matches the filter.': '没有文件匹配过滤条件。',

    // sftpBrowser.component.pug — floating menus
    'Create a folder': '创建文件夹',
    'Create a file': '创建文件',
    'Display settings': '显示设置',
    'Columns': '列',

    // confirmModal.component.ts/.pug
    'Confirm': '确认',
    'Cancel': '取消',

    // noteModal.component.pug
    'Note: {name}': '备注：{name}',
    'Restart commands, maintenance reminders, ticket numbers…': '重启命令、维护提醒、工单号…',
    'Clearing the field removes the note.': '清空该字段即删除备注。',
    'Save': '保存',

    // pasteGroupModal.component.ts/.pug
    'Paste the folder: {name}': '粘贴文件夹：{name}',
    'A folder named <strong>{name}</strong> already exists at the root.': '根目录下已存在名为 <strong>{name}</strong> 的文件夹。',
    'To paste: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.':
        '待粘贴：{folders, plural, other {# 个文件夹}}，{profiles, plural, other {# 个配置}}。',
    'Removed from the export: {info}. Re-enter after pasting.': '已从导出中移除：{info}。粘贴后请重新输入。',
    'Paste alongside': '并列粘贴',
    'A new folder "{name}". Nothing existing is touched.': '新建文件夹“{name}”。不影响现有内容。',
    'Merge into the existing folder': '合并到现有文件夹',
    'Profiles and subfolders added to "{name}". Duplicates are not detected.': '配置和子文件夹已添加到“{name}”。不会检测重复项。',

    // snippetsModal.component.pug
    'Snippets: {name}': '片段：{name}',
    'No snippets.': '没有片段。',
    'Variables and behaviour of this snippet here': '在此设置该片段的变量和行为',
    'Remove from here: stays in the library': '从此处移除：仍保留在库中',
    'Detach': '分离',
    'Variables': '变量',
    'Required, not filled in.': '必填，尚未填写。',
    '"{value}" contains a space and is not quoted. Write "{token}" in the command, or quote the value here.':
        '“{value}”含空格且未加引号。请在命令中写“{token}”，或在此为值加引号。',
    'Behaviour': '行为',
    'On click': '点击时',
    'Follow (run)': '跟随（运行）',
    'Follow (write)': '跟随（写入）',
    'Write without confirming': '写入但不确认',
    'Write and run': '写入并运行',
    'Without a session': '无会话时',
    'Follow (launch)': '跟随（启动）',
    'Follow (do nothing)': '跟随（不操作）',
    'Do nothing': '不操作',
    'Launch the session': '启动会话',
    'Wait': '等待',
    'to fill in': '待填写',
    'follow': '跟随',
    'Inherited': '继承',
    'Reactivate here': '在此重新启用',
    'No longer offer here: stays attached to the folder': '不再在此提供：仍附加于该文件夹',
    'Reactivate': '重新启用',
    'Disable here': '在此禁用',
    'Available snippets': '可用片段',
    'Attach here': '附加到此处',
    'Attach': '附加',
    'Inherit (run)': '继承（运行）',
    'Inherit (write)': '继承（写入）',
    'Inherit (launch)': '继承（启动）',
    'Inherit (do nothing)': '继承（不操作）',
    'Inherited from the content of the folder.': '继承自该文件夹的内容。',
    'Manage the library': '管理片段库',
    'Close': '关闭',

    // transfers.component.pug — header, per-row states and tooltips (lot 3)
    'Transfers': '传输',
    'Clear the list — running transfers will be cancelled': '清空列表——正在进行的传输将被取消',
    'Transfer finished — the system is still placing the file at its destination. The shown duration is an estimate: nothing signals when this copy ends.': '传输已完成——系统仍在将文件放置到目标位置。显示的时长只是估计：系统不会通知此复制何时结束。',
    'handing over to the system…': '正在交由系统处理…',
    'cancelled': '已取消',
    'interrupted at {percent} %': '在 {percent}% 处中断',
    'incomplete at destination': '目标处不完整',
    'Estimated time remaining': '预计剩余时间',
    'Elapsed time': '已用时间',
    'Cancel this transfer and remove it': '取消此传输并将其移除',
    'Remove from the list': '从列表中移除',

    // transfers.component.ts — confirmations
    'Cancel "{name}" while it is running?': '在“{name}”运行时取消它？',
    'Cancel the transfer': '取消传输',
    'One transfer is still running. Clearing the list will cancel it. Continue?': '还有一个传输正在进行。清空列表将取消它。是否继续？',
    '{count} transfers are still running. Clearing the list will cancel them. Continue?': '还有 {count} 个传输正在进行。清空列表将取消它们。是否继续？',
    'Clear and cancel': '清空并取消',

    // transfersRegistry.service.ts — badge, breakdown tooltip, row tooltip
    'Session: {label}': '会话：{label}',
    '{count} running': '{count} 个进行中',
    '{count, plural, one {# finished} other {# finished}}': '{count, plural, other {# 项已完成}}',
    '{count, plural, one {# cancelled} other {# cancelled}}': '{count, plural, other {# 项已取消}}',
    '{count, plural, one {# interrupted} other {# interrupted}}': '{count, plural, other {# 项已中断}}',
    '{count, plural, one {# incomplete at destination} other {# incomplete at destination}}': '{count, plural, other {# 项目标处不完整}}',

    // sidebarTree.component.pug — view tabs, live sessions, recents, tunnels (lot 3)
    'Profiles': '配置',
    'SFTP of the active session': '活动会话的 SFTP',
    'Active sessions': '活动会话',
    'Open the SFTP of this session': '打开此会话的 SFTP',
    'Recently launched': '最近启动',
    'Active tunnels': '活动隧道',
    'resuming…': '正在恢复…',
    'not restored': '未恢复',
    'Open {url} in the browser': '在浏览器中打开 {url}',
    'Go to the session': '转到会话',

    // sidebarTree.component.pug — workspace bar, filter, selection, hidden items
    'All': '全部',
    'New workspace': '新建工作区',
    'Filter (Ctrl+F)': '过滤（Ctrl+F）',
    'Hidden items in this workspace': '此工作区中隐藏的项目',
    '{count, plural, one {# profile selected} other {# profiles selected}}': '{count, plural, other {# 个配置已选择}}',
    'Clear the selection': '清除选择',
    'Drag the selection, or right-click the destination folder': '拖动所选内容，或右键点击目标文件夹',
    'No hidden items in this workspace.': '此工作区中没有隐藏项目。',
    'Show again': '重新显示',

    // sidebarTree.component.pug — profile row badges
    'Connected': '已连接',
    'Disconnected': '已断开',
    'No session': '无会话',
    '{count} tunnel(s) mounted on this session': '此会话上已挂载 {count} 个隧道',
    '{count} tunnel(s) configured: mounted when the session launches': '已配置 {count} 个隧道：会话启动时挂载',
    'Upload in progress': '正在上传',
    'Download in progress': '正在下载',

    // sidebarTree.component.pug — context menus
    'Move the selection here ({count})': '将所选内容移动到这里（{count}）',
    'Launch all sessions': '启动所有会话',
    'Edit the note...': '编辑备注…',
    'Add a note...': '添加备注…',
    'Remove from favorites': '从收藏中移除',
    'Add to favorites': '添加到收藏',
    'New folder...': '新建文件夹…',
    'New profile...': '新建配置…',
    'Change the icon...': '更改图标…',
    'Copy the structure (JSON)': '复制结构（JSON）',
    'Copy without credentials': '复制（不含凭据）',
    'Hide in this workspace': '在此工作区中隐藏',
    'Paste the folder': '粘贴文件夹',
    'Profile tunnels...': '配置隧道…',
    'Edit...': '编辑…',
    'Duplicate': '克隆',

    // sidebarTree.component.pug — icon picker
    'Choose an icon': '选择图标',
    'Remove the icon': '移除图标',
    'Favorites': '收藏',
    'Right-click an icon: "Add to favorites"': '右键点击图标：“添加到收藏”',
    'Recently used': '最近使用',
    'Search (e.g. server, folder, star...)': '搜索（如 服务器、文件夹、星标…）',
    'Import from an SVG...': '从 SVG 导入…',
    'Apply the SVG': '应用 SVG',

    // sidebarTree.component.pug — icon picker, dashboard-icons variant dots
    'Default variant': '默认变体',
    'Light variant': '浅色变体',
    'Dark variant': '深色变体',

    // sidebarTree.component.pug — rename/create popups
    'Rename': '重命名',
    'New folder': '新建文件夹',
    'Folder name': '文件夹名称',
    'Create': '创建',

    // sidebarTree.component.pug — profile tunnels popup
    'Tunnels: {name}': '隧道：{name}',
    'No tunnels configured on this profile.': '此配置上没有配置隧道。',
    'Double-click to edit this tunnel': '双击以编辑此隧道',
    'Delete this tunnel': '删除此隧道',
    'This tunnel is currently mounted on the open session. Deleting it here would remove its configuration without cutting the tunnel, which would keep running until the session closes. Close the session to be able to delete it.':
        '此隧道当前挂载在打开的会话上。在此删除只会移除其配置而不会切断隧道，隧道会继续运行直到会话关闭。请关闭会话后再删除。',
    'Listening port': '监听端口',
    'Target host': '目标主机',
    'Target port': '目标端口',
    'Description (optional)': '描述（可选）',
    'Add the tunnel': '添加隧道',
    'Takes effect at the next session launch.': '将在下次启动会话时生效。',

    // sidebarTree.component.pug — profile/workspace popups, footer
    'New profile': '新配置',
    'Delete the profile': '删除配置',
    'Delete "{name}"? This action is irreversible.': '删除“{name}”？此操作不可撤销。',
    'Icon...': '图标…',
    'Color...': '颜色…',
    'Copy (JSON)': '复制（JSON）',
    'Manage this workspace': '管理工作区',
    'New workspace...': '新建工作区…',
    'Workspace name': '工作区名称',
    'Import from the clipboard': '从剪贴板导入',
    'Rename the workspace': '重命名工作区',
    'Workspace color': '工作区颜色',
    'Remove the color': '移除颜色',
    'Delete the workspace': '删除工作区',
    'Delete "{name}"? Hidden profiles and folders become visible everywhere else. This action is irreversible.':
        '删除“{name}”？隐藏的配置和文件夹将在其它工作区中重新可见。此操作不可撤销。',
    'Better Sidebar settings': '侧边栏+ 设置',

    // sidebarTree.component.ts — snippets notices, workspaces, pinned group
    'Variables to fill in on "{name}"': '“{name}”上待填写的变量',
    '{detail}: right-click the profile, "Snippets", then the snippet settings button.': '{detail}：右键点击配置，选择“片段”，然后点击片段设置按钮。',
    'This folder contains no profile to launch': '此文件夹中没有可启动的配置',
    'The clipboard does not hold an exported workspace.': '剪贴板中没有导出的工作区。',
    'Imported workspace': '导入的工作区',
    'Workspace "{name}" imported.': '工作区“{name}”已导入。',
    'Workspace "{name}" copied.': '工作区“{name}”已复制。',
    'Pinned': '已固定',
    '"{name}" expects a value': '“{name}”需要一个值',
    '{list}: to fill in under "Snippets".': '{list}：在“片段”下填写。',
    '"{name}" has no open session': '“{name}”没有打开的会话',
    'The session of "{name}" did not open': '“{name}”的会话未能打开',

    // sidebarTree.component.ts — session tooltips, uptime units (only the day unit varies)
    'Transfers: {count} running, total speed {speed}': '传输：{count} 个进行中，总速度 {speed}',
    'Transfers: {count} running': '传输：{count} 个进行中',
    '{d}d {h}h': '{d} 天 {h} 小时',
    '{d} d {h} h': '{d} 天 {h} 时',

    // sidebarTree.component.ts — tunnels (rows, hints, editor)
    '{detail}: session cut, tunnel waiting to resume': '{detail}：会话中断，隧道等待恢复',
    '{detail}: not restored after the reconnection. Only the tunnels saved in the profile are remounted; a tunnel added on the fly disappears with its session.':
        '{detail}：重连后未恢复。只有保存在配置中的隧道会重新挂载；临时添加的隧道会随会话消失。',
    'Tunnel {detail} already mounted by {owner}: duplicate dismounted ({session})': '隧道 {detail} 已由 {owner} 挂载：已卸载重复项（{session}）',
    'Listens on the remote server. The destination is resolved from your PC.': '在远程服务器上监听。目标地址从你的电脑解析。',
    'Opens a SOCKS proxy on your PC, with no fixed destination.': '在你的电脑上打开 SOCKS 代理，没有固定目标。',
    'Listens on your PC. The destination is resolved from the server, so "localhost" there means the server.':
        '在你的电脑上监听。目标地址从服务器解析，因此那里的“localhost”指服务器。',
    'Enter a listening port.': '请输入监听端口。',
    'Enter the destination host and port.': '请输入目标主机和端口。',
    'Tunnel updated': '隧道已更新',
    'Tunnel saved': '隧道已保存',
    'The current session keeps the old one until it is relaunched.': '当前会话在重新启动前仍使用旧的配置。',
    'It will be mounted at the next launch of this session.': '将在下次启动此会话时挂载。',
    'This tunnel is mounted on the current session. Close the session to be able to delete it.': '此隧道挂载在当前会话上。请关闭会话后再删除。',

    // sidebarTree.component.ts — selection moves, folder ops, sharing
    'No group': '无分组',
    '{count} profiles moved to "{where}"': '已将 {count} 个配置移动到“{where}”',
    'Profile moved to "{where}"': '配置已移动到“{where}”',
    'Moving the folder failed': '移动文件夹失败',
    'SVG rejected.': 'SVG 被拒绝。',
    'No provider handles "{name}": opening the settings': '没有提供程序处理“{name}”：正在打开设置',
    '{name} - Copy': '{name} - 副本',
    'Folder "{name}" copied: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.':
        '文件夹“{name}”已复制：{folders, plural, other {# 个文件夹}}，{profiles, plural, other {# 个配置}}。',
    'Removed: {purged}.': '已移除：{purged}。',
    'The clipboard does not hold a shared folder.': '剪贴板中没有共享的文件夹。',
    'Pasted folder': '粘贴的文件夹',
    'Folder "{name}" pasted: {folders, plural, one {# folder} other {# folders}}, {profiles, plural, one {# profile} other {# profiles}}.':
        '文件夹“{name}”已粘贴：{folders, plural, other {# 个文件夹}}，{profiles, plural, other {# 个配置}}。',
    'Removed at export: {purged}. To be re-entered.': '导出时已移除：{purged}。需要重新输入。',
    '{count, plural, one {Profile type not installed} other {Profile types not installed}}: {list}.':
        '{count, plural, other {未安装的配置类型}}：{list}。',
    'This JSON still carried secrets its own header declared removed.': '此 JSON 仍带有其头部声明已移除的机密。',
    'Removed at paste: {purged}.': '粘贴时已移除：{purged}。',
    '{count, plural, one {# subfolder} other {# subfolders}}': '{count, plural, other {# 个子文件夹}}',
    '{count, plural, one {# profile} other {# profiles}}': '{count, plural, other {# 个配置}}',
    '{a} and {b}': '{a} 和 {b}',
    'current': '当前',
    'This content is hidden in the workspace "{name}".': '此内容在工作区“{name}”中被隐藏。',
    'Cannot delete "{name}"': '无法删除“{name}”',
    'This folder still contains {reasons}.{hint} Empty it first.': '此文件夹仍包含 {reasons}。{hint} 请先清空它。',

    // settingsTab.component.ts — nav + general page
    'General': '通用',
    'Features': '功能',
    'Show the sidebar': '显示侧边栏',
    'Removes the sidebar without uninstalling anything.': '移除侧边栏但不会卸载任何东西。',
    'Untick to hide it; this page stays reachable.': '取消勾选即可隐藏；此页面仍可访问。',
    'Hide the Tabby transfers menu': '隐藏 Tabby 的传输菜单',
    'Otherwise the native Tabby menu opens on every transfer.': '否则每次传输时 Tabby 原生菜单都会弹出。',
    'The sidebar panel already shows the same transfers.': '侧边栏面板已经显示了相同的传输。',

    // settingsTab.component.ts — features page
    'Each block switches on independently. Nothing is deleted by turning one off.': '每个区块独立开关。关闭某个区块不会删除任何内容。',
    'Mirrors the state of Tabby port forwarding.': '镜像 Tabby 端口转发的状态。',
    'Port forwarding panel and badges on the profiles.': '端口转发面板以及配置上的徽标。',
    'Unavailable on this version of Tabby. Your setting is kept.': '此版本的 Tabby 上不可用。你的设置已保留。',
    'Workspaces': '工作区',
    '"All" excludes nothing; the filter bar searches everywhere.': '“全部”不排除任何内容；过滤栏在所有位置搜索。',
    'Workspace bar, above the list.': '工作区栏，位于列表上方。',
    'Presentation': '呈现方式',
    'Tabs or a compact list, as you prefer.': '标签页或紧凑列表，任你选择。',
    'Changes how the workspace bar is displayed.': '更改工作区栏的显示方式。',
    'Tabs (wrap onto new lines)': '标签页（换行显示）',
    'Dropdown list': '下拉列表',
    'Filter bar': '过滤栏',
    'Searches the name, description, host and username.': '搜索名称、描述、主机和用户名。',
    'Search field and shortcut': '搜索框和快捷键',
    'A library of commands attached to profiles and folders.': '附加到配置和文件夹的命令库。',
    'The "Snippets" entry of the right click and its dedicated tab.': '右键菜单中的“片段”项及其专属标签页。',
    'Notes': '备注',
    'A free-form memo per profile or folder.': '为每个配置或文件夹保存的自由备注。',
    'The "note" entry of the right click and its badge.': '右键菜单中的“备注”项及其徽标。',
    'Recent profiles': '最近配置',
    'The 5 most recently launched profiles, all types together.': '最近启动的 5 个配置，包含所有类型。',
    'A list shown under the active sessions.': '显示在活动会话下方的列表。',
    'One row per pane, not per tab.': '每个窗格一行，而非每个标签页。',
    'Open SSH connections, at the top of the sidebar.': '打开的 SSH 连接，位于侧边栏顶部。',
    'Latency probe, in seconds': '延迟探测，单位秒',
    'A real SFTP round trip, not an ICMP ping.': '真实的 SFTP 往返，而非 ICMP ping。',
    'Colors the dot of each session. 0 disables.': '为每个会话的圆点着色。0 表示禁用。',

    // settingsTab.component.ts — SFTP block
    'SFTP view': 'SFTP 视图',
    'One SFTP channel per session actually browsed.': '每个实际浏览的会话一个 SFTP 通道。',
    'The SFTP tab of the sidebar and its panel.': '侧边栏的 SFTP 标签页及其面板。',
    'Remote file editor': '远程文件编辑器',
    'The file is copied, edited, then sent back to the server.': '文件被复制、编辑，然后发送回服务器。',
    'Program opened on double-click. Empty, Windows decides.': '双击时打开的程序。留空则由 Windows 决定。',
    'No editor chosen': '未选择编辑器',
    'Browse...': '浏览…',
    'Erase': '清除',
    'Drag a folder out to Explorer': '将文件夹拖拽到资源管理器',
    'The folder is downloaded in full before the drop.': '拖放前会先完整下载该文件夹。',
    'Beyond 25 files or 20 MB, confirmation is asked.': '超过 25 个文件或 20 MB 时会请求确认。',
    'Automatic refresh, in seconds': '自动刷新，单位秒',
    'Only changed entries are redrawn.': '仅重绘发生变化的条目。',
    '0 disables; every cycle re-reads the folder.': '0 表示禁用；每个周期都会重新读取文件夹。',
    'Return to Profiles when no SSH session is open any more': '不再有打开的 SSH 会话时返回配置视图',
    'Also covers the waiting screen of the SFTP panel.': '也适用于 SFTP 面板的等待界面。',
    'Waits for the grace period of the displayed session to end.': '等待所显示会话的宽限期结束。',
    'Deletion: button activated by Enter': '删除：按回车激活按钮',
    'No deletion can be undone afterwards.': '删除后无法撤销。',
    'Applies to': '适用于',
    'and to the right click.': '以及右键菜单。',
    'always cancels.': '始终取消。',
    'Del': 'Del',
    'Esc': 'Esc',
    'Cancel: the safe answer (default)': '取消：安全的答案（默认）',
    'Delete: Del then Enter in one gesture': '删除：一键完成 Del 然后 Enter',
    'Transfer manager': '传输管理器',
    'Also mirrors the transfers of the native SFTP panel.': '也镜像原生 SFTP 面板的传输。',
    'Panel shown at the bottom of the sidebar.': '显示在侧边栏底部的面板。',

    // settingsTab.component.ts — snippet library
    'A command written once, usable everywhere it is attached.': '命令写一次，附加到的任何地方都可用。',
    'No snippets yet.': '还没有片段。',
    '{count} snippet(s) attached to nothing.': '{count} 个片段未附加到任何内容。',
    'Detached from the sidebar, they stay here until deleted.': '从侧边栏分离后，它们会保留在此处直到被删除。',
    'attached to {count} item(s)': '已附加到 {count} 项',
    'attached nowhere': '未附加',
    'Modify': '修改',
    'New snippet': '新建片段',
    'What the context menu shows.': '右键菜单中显示的内容。',
    'Restart nginx': '重启 nginx',
    'Command': '命令',
    'Use': '使用',
    'for a required value, or': '表示必填值，或',
    'for a default value.': '表示默认值。',
    'Changes the command on the {count} existing attachment(s).': '更改 {count} 个现有附件上的命令。',
    'Delete the snippet "{name}"? It is attached to {count} item(s), which will lose it.': '删除片段“{name}”？它已附加到 {count} 项，这些项将失去它。',
    'Delete the snippet "{name}"?': '删除片段“{name}”？',

    // profileModal.ts — PROFILE_MODAL_UNAVAILABLE
    'The Tabby profile window has changed — profile creation and editing are unavailable in this version':
        'Tabby 配置窗口已更改——此版本中无法创建和编辑配置',

    // groupShare.ts — parsePayload() errors, describePurge() clauses
    'The clipboard is empty.': '剪贴板为空。',
    'The clipboard content is too large to be a shared folder.': '剪贴板内容过大，不可能是共享的文件夹。',
    'The clipboard does not contain JSON — copy a folder from the sidebar first.': '剪贴板中不含 JSON——请先从侧边栏复制一个文件夹。',
    'The clipboard does not contain a shared folder.': '剪贴板中不含共享的文件夹。',
    'This JSON was not produced by "Copy the structure" from this sidebar.': '此 JSON 并非由本侧边栏的“复制结构”生成。',
    'This folder was exported by a newer version of the plugin (format {version}).': '此文件夹由更新版本的插件导出（格式 {version}）。',
    'This shared folder is incomplete: it contains no group.': '此共享文件夹不完整：不包含任何分组。',
    '{count, plural, one {# password} other {# passwords}}': '{count, plural, other {# 个密码}}',
    '{count, plural, one {# login script} other {# login scripts}}': '{count, plural, other {# 个登录脚本}}',
    '{count, plural, one {# vault key} other {# vault keys}}': '{count, plural, other {# 个保险库密钥}}',
    '{count, plural, one {# key path} other {# key paths}}': '{count, plural, other {# 个密钥路径}}',
    '{count, plural, one {# credential} other {# credentials and routes}}': '{count, plural, other {# 个凭据和路由}}',
    '{count, plural, one {# sensitive field} other {# sensitive fields}}': '{count, plural, other {# 个敏感字段}}',
    '{count, plural, one {# proxy command} other {# proxy commands}}': '{count, plural, other {# 个代理命令}}',
    '{count, plural, one {# unrecognised option} other {# unrecognised options}}': '{count, plural, other {# 个无法识别的选项}}',
    '{count, plural, one {# profile of an unsupported type} other {# profiles of an unsupported type}}': '{count, plural, other {# 个不受支持类型的配置}}',

    // workspaceShare.ts — parseWorkspacePayload() errors
    'The clipboard content is too large to be an exported workspace.': '剪贴板内容过大，不可能是导出的工作区。',
    'The clipboard does not contain JSON — copy an exported workspace first.': '剪贴板中不含 JSON——请先复制一个导出的工作区。',
    'The clipboard does not contain an exported workspace.': '剪贴板中不含导出的工作区。',
    'This workspace was exported by a newer version of the plugin (format {version}).': '此工作区由更新版本的插件导出（格式 {version}）。',
    'This exported workspace is incomplete.': '此导出的工作区不完整。',

    // svgSanitizer.ts — sanitizeSvgIcon()
    'The SVG is empty.': 'SVG 为空。',
    'SVG too large (limit: {limit} characters).': 'SVG 过大（上限：{limit} 个字符）。',
    'Invalid SVG, or entirely rejected by sanitisation.': '无效的 SVG，或完全被清理过程拒绝。',
    'The root must be a single <svg> tag.': '根元素必须是单个 <svg> 标签。',
    '{count} disallowed element(s) or attribute(s) removed.': '已移除 {count} 个不允许的元素或属性。',

    // sidebarTree.component.pug — "Manage"/"More" lateral submenus (folder + profile menus)
    'Manage': '管理',
    'More': '更多',

    // settingsTab.component.ts — Seitenkopf, dem von Better Vault nachgebildet
    'Enhanced connection sidebar': '增强的连接侧边栏',
    'Every block below can be switched off; the sidebar itself can too.': '下面的每个区块都可以关闭；侧边栏本身也可以。',

    // sidebarTree.component.pug — outbound links in the footer
    'Open the project repository': '打开项目仓库',
    'Open the author profile on GitHub': '在 GitHub 上打开作者主页',

}

export default zh_CN
