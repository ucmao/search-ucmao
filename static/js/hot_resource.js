// hot_resource.js 完整修复版

// ==========================================
// 1. 全局变量与配置
// ==========================================
let currentPage = 1;
const pageSize = 25;
let totalPages = 1;
let resourcesData = [];

// ==========================================
// 2. DOM 元素获取
// ==========================================
const searchInput = document.getElementById('searchInput');
const resourcesTableBody = document.getElementById('resourcesTableBody');
const pagination = document.getElementById('pagination');

// 模态框与表单
const addResourceForm = document.getElementById('addResourceForm');
const editResourceForm = document.getElementById('editResourceForm');
const batchAddResourceForm = document.getElementById('batchAddResourceForm');

// 按钮
const saveResourceBtn = document.getElementById('saveResourceBtn');
const updateResourceBtn = document.getElementById('updateResourceBtn');
const batchSaveResourceBtn = document.getElementById('batchSaveResourceBtn');
const exportCurrentPageBtn = document.getElementById('exportCurrentPageBtn');
const exportAllPagesBtn = document.getElementById('exportAllPagesBtn');

// Cookie 配置相关元素
const cookieConfigModal = document.getElementById('cookieConfigModal');
const saveCookieConfigBtn = document.getElementById('saveCookieConfigBtn');
const baiduCookieInput = document.getElementById('baiduCookie');
const quarkCookieInput = document.getElementById('quarkCookie');

// ==========================================
// 3. 核心工具函数
// ==========================================

// 网盘匹配函数
function matchNetdiskLink(link) {
    if (!link) return "其他";
    const netdiskRules = [
        // 网盘
        ["百度网盘", /(?:https?:\/\/)?(?:pan\.baidu\.com|bdpan\.com|baiduyun\.com)\//i],
        ["夸克网盘", /(?:https?:\/\/)?pan\.quark\.cn\//i],
        ["迅雷网盘", /(?:https?:\/\/)?pan\.xunlei\.com\//i],
        ["UC网盘", /(?:https?:\/\/)?(?:pan\.uc\.cn|drive\.uc\.cn)\//i],
        ["悟空网盘", /(?:https?:\/\/)?pan\.wkbrowser\.com\//i],
        ["快兔网盘", /(?:https?:\/\/)?(?:diskyun\.com|www\.diskyun\.com)\//i],
        ["115网盘", /(?:https?:\/\/)?(?:115\.com|115pan\.com|115cdn\.com|anxia\.com)\//i],
        // 云盘
        ["阿里云盘", /(?:https?:\/\/)?(?:drive\.aliyun\.com|aliyundrive\.com|alipan\.com)\//i],
        ["天翼云盘", /(?:https?:\/\/)?cloud\.189\.cn\//i],
        ["移动云盘", /(?:https?:\/\/)?(?:pan\.10086\.cn|caiyun\.139\.com|yun\.139\.com)\//i],
        ["联通云盘", /(?:https?:\/\/)?pan\.wo\.cn\//i],
        ["123云盘", /(?:https?:\/\/)?(?:123pan\.com|123\d{3}\.com)\//i],
        // 其他
        ["PikPak", /(?:https?:\/\/)?(?:www\.)?pikpak\.com\//i],
        ["磁力链接", /^magnet:\?xt=urn:btih:/i],
        ["迅雷链接", /thunder:\/\/[A-Za-z0-9+\/=]+/i],
        ["电驴链接", /^ed2k:\/\//i]
    ];

    const linkLower = link.trim().toLowerCase();
    for (const [name, pattern] of netdiskRules) {
        if (pattern.test(linkLower)) {
            return name;
        }
    }
    return "其他";
}

// 显示 Toast 消息


// ==========================================
// 4. 数据加载与渲染
// ==========================================

// 加载资源列表
async function loadResources() {
    const searchKeyword = searchInput ? searchInput.value.trim() : '';

    try {
        const response = await fetch(`/api/resources?page=${currentPage}&page_size=${pageSize}&search=${encodeURIComponent(searchKeyword)}`);
        const data = await response.json();

        if (data.success) {
            resourcesData = data.data.items;
            totalPages = data.data.total_pages;
            renderTable();
            renderPagination();
        } else {
            showToast('加载资源失败: ' + (data.message || '未知错误'), 'danger');
        }
    } catch (error) {
        console.error('加载资源失败:', error);
        showToast('网络请求失败，请检查服务状态', 'danger');
    }
}

// 渲染表格
function renderTable() {
    if (!resourcesTableBody) return;
    resourcesTableBody.innerHTML = '';

    if (!resourcesData || resourcesData.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="7" class="text-center">暂无数据</td>';
        resourcesTableBody.appendChild(emptyRow);
        return;
    }

    resourcesData.forEach(resource => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${resource.id}</td>
            <td title="${resource.name}">${resource.name}</td>
            <td><a href="${resource.share_link}" target="_blank" class="text-truncate d-inline-block" style="max-width: 250px;">${resource.share_link}</a></td>
            <td>${resource.cloud_name || '-'}</td>
            <td>${resource.type || '-'}</td>
            <td>${resource.is_replaced ? '<span class="badge bg-success">已同步</span>' : '-'}</td>
            <td class="action-buttons d-flex justify-content-center align-items-center">
                <button class="btn btn-secondary btn-sm copy-btn me-2" data-id="${resource.id}" title="复制链接">
                    <i class="fas fa-copy"></i> 复制
                </button>
                <div class="dropdown">
                    <button class="btn btn-sm btn-secondary dropdown-toggle" type="button"
                        data-bs-toggle="dropdown" aria-expanded="false" title="更多操作">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li>
                            <a class="dropdown-item edit-btn" href="javascript:void(0)" data-id="${resource.id}">
                                <i class="fas fa-edit me-2"></i> 编辑
                            </a>
                        </li>
                        <li><hr class="dropdown-divider"></li>
                        <li>
                            <a class="dropdown-item text-danger delete-btn" href="javascript:void(0)" data-id="${resource.id}">
                                <i class="fas fa-trash me-2"></i> 删除
                            </a>
                        </li>
                    </ul>
                </div>
            </td>
        `;
        resourcesTableBody.appendChild(row);
    });

    // 重新绑定事件监听器
    bindActionEvents();
}

// 渲染分页
function renderPagination() {
    if (!pagination) return;
    pagination.innerHTML = '';

    // 上一页
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage - 1}">&laquo;</a>`;
    pagination.appendChild(prevLi);

    // 页码逻辑
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    if (startPage > 1) {
        pagination.appendChild(createPageItem(1));
        if (startPage > 2) pagination.appendChild(createEllipsis());
    }

    for (let i = startPage; i <= endPage; i++) {
        pagination.appendChild(createPageItem(i));
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) pagination.appendChild(createEllipsis());
        pagination.appendChild(createPageItem(totalPages));
    }

    // 下一页
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage + 1}">&raquo;</a>`;
    pagination.appendChild(nextLi);
}

function createPageItem(page) {
    const li = document.createElement('li');
    li.className = `page-item ${page === currentPage ? 'active' : ''}`;
    li.innerHTML = `<a class="page-link" href="#" data-page="${page}">${page}</a>`;
    return li;
}

function createEllipsis() {
    const li = document.createElement('li');
    li.className = 'page-item disabled';
    li.innerHTML = '<span class="page-link">...</span>';
    return li;
}

// ==========================================
// 5. 交互事件处理 (编辑/删除/复制)
// ==========================================

function bindActionEvents() {
    // 编辑
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => editResource(parseInt(btn.getAttribute('data-id'))));
    });
    // 删除
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteResource(parseInt(btn.getAttribute('data-id'))));
    });
    // 复制
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => copyResource(parseInt(btn.getAttribute('data-id'))));
    });
}

// 复制资源信息
function copyResource(id) {
    const resource = resourcesData.find(r => r.id === id);
    if (!resource) return;

    const copyContent = `标题: ${resource.name}\n链接: ${resource.share_link}\n提取码: ${resource.code || '无'}`;
    navigator.clipboard.writeText(copyContent).then(() => {
        showToast('已复制到剪贴板');
    }).catch(() => {
        showToast('复制失败', 'danger');
    });
}

// 删除资源
async function deleteResource(id) {
    if (await showConfirm('确定要删除这条资源吗？此操作不可恢复。', 'danger')) {
        try {
            const response = await fetch(`/api/resources/${id}`, { method: 'DELETE' });
            const data = await response.json();

            if (data.success) {
                showToast('删除成功');
                loadResources();
            } else {
                showToast(data.message || '删除失败', 'danger');
            }
        } catch (error) {
            showToast('删除请求失败', 'danger');
        }
    }
}

// 获取详情并打开编辑框
async function editResource(id) {
    try {
        const response = await fetch(`/api/resources/${id}`);
        const data = await response.json();

        if (data.success) {
            const res = data.data;
            document.getElementById('editResourceId').value = res.id;
            document.getElementById('editResourceName').value = res.name;
            document.getElementById('editResourceShareLink').value = res.share_link;
            document.getElementById('editResourceCloudName').value = res.cloud_name || '';
            document.getElementById('editResourceType').value = res.type || '';
            document.getElementById('editResourceRemarks').value = res.remarks || '';

            new bootstrap.Modal(document.getElementById('editResourceModal')).show();
        } else {
            showToast(data.message, 'danger');
        }
    } catch (error) {
        showToast('获取详情失败', 'danger');
    }
}

// ==========================================
// 6. 核心业务逻辑 (新增/更新/批量)
// ==========================================

// 保存单个资源
async function saveResource() {
    if (!addResourceForm.checkValidity()) {
        addResourceForm.reportValidity();
        return;
    }

    const shareLink = document.getElementById('resourceShareLink').value.trim();
    const cloudName = matchNetdiskLink(shareLink);

    const saveToNetdisk = {
        quark: document.getElementById('resourceSaveToQuark').checked,
        baidu: document.getElementById('resourceSaveToBaidu').checked,
        ali: document.getElementById('resourceSaveToAli').checked,
        xunlei: document.getElementById('resourceSaveToXunlei').checked,
        uc: document.getElementById('resourceSaveToUc').checked,
        wukong: document.getElementById('resourceSaveToWukong').checked,
        // '115' removed based on commented out html, add back if needed
    };

    const payload = {
        name: document.getElementById('resourceName').value.trim(),
        share_link: shareLink,
        cloud_name: cloudName,
        type: document.getElementById('resourceType').value,
        remarks: document.getElementById('resourceRemarks').value.trim(),
        save_to_netdisk: saveToNetdisk
    };

    // 状态切换
    saveResourceBtn.disabled = true;
    saveResourceBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 保存中...';

    try {
        const response = await fetch('/api/resources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.success) {
            showToast('资源添加成功');
            bootstrap.Modal.getInstance(document.getElementById('addResourceModal')).hide();
            addResourceForm.reset();
            loadResources();
        } else {
            showToast(data.message || '添加失败', 'danger');
        }
    } catch (error) {
        console.error(error);
        showToast('请求失败，请检查网络', 'danger');
    } finally {
        // 关键：无论成功失败都恢复按钮
        saveResourceBtn.disabled = false;
        saveResourceBtn.innerHTML = '<i class="fas fa-save"></i> 保存';
    }
}

// 更新资源
async function updateResource() {
    if (!editResourceForm.checkValidity()) {
        editResourceForm.reportValidity();
        return;
    }

    const id = document.getElementById('editResourceId').value;
    const shareLink = document.getElementById('editResourceShareLink').value.trim();
    const cloudName = matchNetdiskLink(shareLink);

    const payload = {
        name: document.getElementById('editResourceName').value.trim(),
        cloud_name: cloudName,
        type: document.getElementById('editResourceType').value,
        remarks: document.getElementById('editResourceRemarks').value.trim()
    };

    updateResourceBtn.disabled = true;
    updateResourceBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 更新中...';

    try {
        const response = await fetch(`/api/resources/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.success) {
            showToast('更新成功');
            bootstrap.Modal.getInstance(document.getElementById('editResourceModal')).hide();
            loadResources();
        } else {
            showToast(data.message || '更新失败', 'danger');
        }
    } catch (error) {
        showToast('更新请求异常', 'danger');
    } finally {
        updateResourceBtn.disabled = false;
        updateResourceBtn.innerHTML = '<i class="fas fa-save"></i> 保存修改';
    }
}

// 批量添加解析逻辑
function parseBatchResources(content) {
    const resources = [];
    const lines = content.split('\n');
    let currentResource = {};

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        // 匹配标题 (支持中英文冒号)
        const titleMatch = line.match(/^(?:标题|name)[:：]\s*(.+)$/i);
        if (titleMatch) {
            if (currentResource.name && currentResource.share_link) {
                resources.push(currentResource);
                currentResource = {};
            }
            currentResource.name = titleMatch[1].trim();
            return;
        }

        // 匹配链接
        const linkMatch = line.match(/^(?:链接|分享链接|share_link)[:：]\s*(.+)$/i);
        if (linkMatch) {
            currentResource.share_link = linkMatch[1].trim();
            if (!currentResource.cloud_name) {
                currentResource.cloud_name = matchNetdiskLink(currentResource.share_link);
            }
            return;
        }

        // 匹配类型
        const typeMatch = line.match(/^(?:类型|type)[:：]\s*(.+)$/i);
        if (typeMatch) {
            currentResource.type = typeMatch[1].trim();
            return;
        }
        
        // 匹配备注
        const remarkMatch = line.match(/^(?:备注|remark|remarks)[:：]\s*(.+)$/i);
        if (remarkMatch) {
            currentResource.remarks = remarkMatch[1].trim();
            return;
        }
    });

    // 推送最后一条
    if (currentResource.name && currentResource.share_link) {
        resources.push(currentResource);
    }

    return resources;
}

// 批量保存
async function batchSaveResources() {
    const content = document.getElementById('batchResourceContent').value.trim();
    if (!content) {
        showToast('请输入内容', 'warning');
        return;
    }

    const resources = parseBatchResources(content);
    if (resources.length === 0) {
        showToast('未能解析出有效资源，请检查格式', 'danger');
        return;
    }

    if (resources.length > 10) {
        showToast('单次添加建议不超过10条', 'warning');
        return;
    }

    const commonType = document.getElementById('batchResourceType').value;
    const commonRemarks = document.getElementById('batchResourceRemarks').value.trim();

    const saveToNetdisk = {
        quark: document.getElementById('resourceSaveToQuark').checked,
        baidu: document.getElementById('resourceSaveToBaidu').checked,
        ali: document.getElementById('resourceSaveToAli').checked,
        xunlei: document.getElementById('resourceSaveToXunlei').checked,
        uc: document.getElementById('resourceSaveToUc').checked,
        wukong: document.getElementById('resourceSaveToWukong').checked,
        // '115' removed based on commented out html, add back if needed
    };

    // 锁定按钮
    batchSaveResourceBtn.disabled = true;
    let successCount = 0;

    try {
        for (let i = 0; i < resources.length; i++) {
            const res = resources[i];
            // 更新按钮文字显示进度
            batchSaveResourceBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> 正在保存 ${i + 1}/${resources.length}`;

            const payload = {
                name: res.name,
                share_link: res.share_link,
                cloud_name: res.cloud_name || matchNetdiskLink(res.share_link),
                type: res.type || commonType,
                remarks: res.remarks || commonRemarks,
                save_to_netdisk: saveToNetdisk
            };

            const response = await fetch('/api/resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (data.success) successCount++;
        }

        showToast(`批量处理完成：成功 ${successCount}，失败 ${resources.length - successCount}`, 'success');
        
        bootstrap.Modal.getInstance(document.getElementById('batchAddResourceModal')).hide();
        batchAddResourceForm.reset();
        loadResources();

    } catch (error) {
        console.error(error);
        showToast('批量处理过程中断', 'danger');
    } finally {
        // 恢复按钮
        batchSaveResourceBtn.disabled = false;
        batchSaveResourceBtn.innerHTML = '<i class="fas fa-save"></i> 批量添加';
    }
}

// ==========================================
// 7. 导出功能 (CSV)
// ==========================================

function convertToCSV(data) {
    if (data.length === 0) return '';
    const headers = ['ID', '标题', '分享链接', '云盘名称', '类型', '备注'];
    const csvContent = [headers.join(',')];

    data.forEach(resource => {
        const row = [
            resource.id,
            `"${(resource.name || '').replace(/"/g, '""')}"`,
            `"${(resource.share_link || '').replace(/"/g, '""')}"`,
            `"${(resource.cloud_name || '').replace(/"/g, '""')}"`,
            `"${(resource.type || '').replace(/"/g, '""')}"`,
            `"${(resource.remarks || '').replace(/"/g, '""')}"`
        ];
        csvContent.push(row.join(','));
    });
    return "\uFEFF" + csvContent.join('\n'); // 添加 BOM 防止乱码
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportCurrentPage() {
    if (resourcesData.length === 0) {
        showToast('当前页无数据', 'warning');
        return;
    }
    const csv = convertToCSV(resourcesData);
    downloadCSV(csv, `资源列表_第${currentPage}页_${new Date().toISOString().slice(0, 10)}.csv`);
}

async function exportAllPages() {
    if (await showConfirm('确定要导出全部数据吗？数据量大时可能需要较长时间。')) {
        const exportBtn = document.getElementById('exportAllPagesBtn');
        const originalText = exportBtn.innerHTML;
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 导出中...';

        try {
            // 先获取第一页以确定总数
            const searchKeyword = searchInput ? searchInput.value.trim() : '';
            const res1 = await fetch(`/api/resources?page=1&page_size=${pageSize}&search=${encodeURIComponent(searchKeyword)}`);
            const data1 = await res1.json();
            
            if (!data1.success) throw new Error(data1.message);

            let allItems = [...data1.data.items];
            const totalP = data1.data.total_pages;

            if (totalP > 1) {
                const promises = [];
                for (let i = 2; i <= totalP; i++) {
                    promises.push(
                        fetch(`/api/resources?page=${i}&page_size=${pageSize}&search=${encodeURIComponent(searchKeyword)}`)
                            .then(r => r.json())
                            .then(d => d.success ? d.data.items : [])
                    );
                }
                const results = await Promise.all(promises);
                results.forEach(items => allItems = allItems.concat(items));
            }

            const csv = convertToCSV(allItems);
            downloadCSV(csv, `资源列表_全部_${new Date().toISOString().slice(0, 10)}.csv`);
            showToast(`成功导出 ${allItems.length} 条数据`);

        } catch (error) {
            showToast('导出失败: ' + error.message, 'danger');
        } finally {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalText;
        }
    }
}

// 加载现有的 Cookie 配置
async function loadCookieConfig() {
    try {
        const response = await fetch('/cookie-config');
        const data = await response.json();
        if (baiduCookieInput) baiduCookieInput.value = data.baidu_cookie || '';
        if (quarkCookieInput) quarkCookieInput.value = data.quark_cookie || '';
    } catch (error) {
        console.error('加载Cookie失败:', error);
    }
}

// 保存 Cookie 配置
async function saveCookieConfig() {
    const payload = {
        baidu_cookie: baiduCookieInput.value.trim(),
        quark_cookie: quarkCookieInput.value.trim()
    };

    try {
        const response = await fetch('/cookie-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.success) {
            showToast('Cookie配置保存成功', 'success');
            // 关闭模态框 (使用 Bootstrap 原生方法)
            const modalInstance = bootstrap.Modal.getInstance(cookieConfigModal);
            if (modalInstance) modalInstance.hide();
        } else {
            showToast('保存失败: ' + data.message, 'error');
        }
    } catch (error) {
        showToast('请求失败，请检查网络', 'error');
    }
}


// ==========================================
// 8. 初始化入口 (统一)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 初始加载
    loadResources();

    // 绑定分页点击事件 (委托)
    if (pagination) {
        pagination.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.target.closest('a');
            if (target) {
                const page = parseInt(target.getAttribute('data-page'));
                if (!isNaN(page) && page >= 1 && page <= totalPages && page !== currentPage) {
                    currentPage = page;
                    loadResources();
                }
            }
        });
    }

    // 绑定搜索
    if (searchInput) {
        let timeout = null;
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                currentPage = 1;
                loadResources();
            }, 300); // 防抖
        });
    }

    // 绑定 Cookie 模态框显示时加载数据
    if (cookieConfigModal) {
        cookieConfigModal.addEventListener('show.bs.modal', loadCookieConfig);
    }

    // 绑定保存按钮
    if (saveCookieConfigBtn) {
        saveCookieConfigBtn.addEventListener('click', saveCookieConfig);
    }

    // 绑定按钮事件
    if (saveResourceBtn) saveResourceBtn.addEventListener('click', saveResource);
    if (updateResourceBtn) updateResourceBtn.addEventListener('click', updateResource);
    if (batchSaveResourceBtn) batchSaveResourceBtn.addEventListener('click', batchSaveResources);
    if (exportCurrentPageBtn) exportCurrentPageBtn.addEventListener('click', exportCurrentPage);
    if (exportAllPagesBtn) exportAllPagesBtn.addEventListener('click', exportAllPages);
});