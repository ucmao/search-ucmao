// 全局变量
let currentPage = 1;
const pageSize = 25;
let totalPages = 1;
let resourcesData = [];

// DOM 元素
const searchInput = document.getElementById('searchInput');
const resourcesTableBody = document.getElementById('resourcesTableBody');
const pagination = document.getElementById('pagination');
const addResourceForm = document.getElementById('addResourceForm');
const editResourceForm = document.getElementById('editResourceForm');
const saveResourceBtn = document.getElementById('saveResourceBtn');
const updateResourceBtn = document.getElementById('updateResourceBtn');

// 网盘匹配函数
function matchNetdiskLink(link) {
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
        // 其他网盘
        ["PikPak", /(?:https?:\/\/)?(?:www\.)?pikpak\.com\//i],
        // 链接类型
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

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadResources();
    
    // 搜索功能
    searchInput.addEventListener('input', (e) => {
        currentPage = 1;
        loadResources();
    });
    
    // 保存新资源
    saveResourceBtn.addEventListener('click', saveResource);
    
    // 更新资源
    updateResourceBtn.addEventListener('click', updateResource);
    
    // 批量保存资源
    const batchSaveResourceBtn = document.getElementById('batchSaveResourceBtn');
    batchSaveResourceBtn.addEventListener('click', batchSaveResources);
});

// 加载资源列表
async function loadResources() {
    const searchKeyword = searchInput.value.trim();
    
    try {
        const response = await fetch(`/api/resources?page=${currentPage}&page_size=${pageSize}&search=${encodeURIComponent(searchKeyword)}`);
        const data = await response.json();
        
        if (data.success) {
            resourcesData = data.data.items;
            totalPages = data.data.total_pages;
            renderTable();
            renderPagination();
        } else {
            showToast('加载资源失败', 'danger');
        }
    } catch (error) {
        console.error('加载资源失败:', error);
        showToast('加载资源失败', 'danger');
    }
}

// 渲染表格
function renderTable() {
    resourcesTableBody.innerHTML = '';
    
    if (resourcesData.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="7" class="text-center">暂无数据</td>';
        resourcesTableBody.appendChild(emptyRow);
        return;
    }
    
    resourcesData.forEach(resource => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${resource.id}</td>
            <td>${resource.name}</td>
            <td><a href="${resource.share_link}" target="_blank">${resource.share_link}</a></td>
            <td>${resource.cloud_name || '-'}</td>
            <td>${resource.type || '-'}</td>
            <td>${resource.is_replaced ? '<span class="status-synced">已同步</span>' : '-'}</td>
            <td class="action-buttons d-flex justify-content-center align-items-center">
                <button class="btn btn-secondary btn-sm copy-btn" data-id="${resource.id}" title="复制链接">
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
    
    // 绑定编辑和删除事件
    bindEditDeleteEvents();
}

// 渲染分页
function renderPagination() {
    pagination.innerHTML = '';
    
    // 上一页按钮
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage - 1}">上一页</a>`;
    pagination.appendChild(prevLi);
    
    // 页码按钮
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
        pagination.appendChild(li);
    }
    
    // 下一页按钮
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<a class="page-link" href="#" data-page="${currentPage + 1}">下一页</a>`;
    pagination.appendChild(nextLi);
    
    // 绑定分页事件
    pagination.addEventListener('click', (e) => {
        e.preventDefault();
        if (e.target.tagName === 'A') {
            const page = parseInt(e.target.getAttribute('data-page'));
            if (page >= 1 && page <= totalPages) {
                currentPage = page;
                loadResources();
            }
        }
    });
}

// 绑定编辑、删除和复制按钮事件
function bindEditDeleteEvents() {
    const editBtns = document.querySelectorAll('.edit-btn');
    const deleteBtns = document.querySelectorAll('.delete-btn');
    const copyBtns = document.querySelectorAll('.copy-btn');
    
    editBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-id'));
            editResource(id);
        });
    });
    
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-id'));
            deleteResource(id);
        });
    });
    
    copyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-id'));
            copyResource(id);
        });
    });
}

// 编辑资源
async function editResource(id) {
    try {
        const response = await fetch(`/api/resources/${id}`);
        const data = await response.json();
        
        if (data.success) {
            const resource = data.data;
            document.getElementById('editResourceId').value = resource.id;
            document.getElementById('editResourceName').value = resource.name;
            document.getElementById('editResourceShareLink').value = resource.share_link;
            document.getElementById('editResourceCloudName').value = resource.cloud_name || '';
            document.getElementById('editResourceType').value = resource.type || '';
            document.getElementById('editResourceRemarks').value = resource.remarks || '';
            
            // 显示编辑模态框
            const editModal = new bootstrap.Modal(document.getElementById('editResourceModal'));
            editModal.show();
        } else {
            showToast('获取资源信息失败', 'danger');
        }
    } catch (error) {
        console.error('获取资源信息失败:', error);
        showToast('获取资源信息失败', 'danger');
    }
}

// 删除资源
async function deleteResource(id) {
    if (confirm('确定要删除这条资源吗？')) {
        try {
            const response = await fetch(`/api/resources/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.success) {
                showToast('删除资源成功', 'success');
                loadResources();
            } else {
                showToast('删除资源失败', 'danger');
            }
        } catch (error) {
            console.error('删除资源失败:', error);
            showToast('删除资源失败', 'danger');
        }
    }
}

// 复制资源
function copyResource(id) {
    const resource = resourcesData.find(r => r.id == id);
    if (!resource) return;
    
    // 构建要复制的内容
    const copyContent = `ID: ${resource.id}
标题: ${resource.name}
分享链接: ${resource.share_link}
云盘名称: ${resource.cloud_name || '-'}
类型: ${resource.type || '-'}
备注: ${resource.remarks || '-'}`;
    
    // 复制到剪贴板
    navigator.clipboard.writeText(copyContent).then(() => {
        showToast('资源信息已复制到剪贴板', 'success');
    }).catch(err => {
        console.error('复制失败:', err);
        showToast('复制失败，请手动复制', 'danger');
    });
}

// 保存新资源
async function saveResource() {
    // 获取保存按钮元素
    const saveBtn = document.getElementById('saveResourceBtn');
    // 禁用按钮防止重复提交
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    
    if (!addResourceForm.checkValidity()) {
        addResourceForm.reportValidity();
        // 恢复按钮状态
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存';
        return;
    }
            
    // 自动判断网盘名称
    const shareLink = document.getElementById('resourceShareLink').value;
    const cloudName = matchNetdiskLink(shareLink);
    document.getElementById('resourceCloudName').value = cloudName;
    
    // 获取转存网盘的选择
    const saveToNetdisk = {
        quark: document.getElementById('resourceSaveToQuark').checked,
        baidu: document.getElementById('resourceSaveToBaidu').checked,
        ali: document.getElementById('resourceSaveToAli').checked,
        xunlei: document.getElementById('resourceSaveToXunlei').checked,
        uc: document.getElementById('resourceSaveToUc').checked,
        '115': document.getElementById('resourceSaveTo115').checked
    };
    
    const resource = {
        name: document.getElementById('resourceName').value,
        share_link: shareLink,
        cloud_name: cloudName,
        type: document.getElementById('resourceType').value,
        remarks: document.getElementById('resourceRemarks').value,
        save_to_netdisk: saveToNetdisk
    };
    
    try {
        const response = await fetch('/api/resources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resource)
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('添加资源成功', 'success');
            // 关闭模态框并重置表单
            const addModal = bootstrap.Modal.getInstance(document.getElementById('addResourceModal'));
            addModal.hide();
            addResourceForm.reset();
            // 重新加载资源列表
            loadResources();
        } else {
            showToast('添加资源失败', 'danger');
        }
    } catch (error) {
        console.error('添加资源失败:', error);
        showToast('添加资源失败', 'danger');
    } finally {
        // 恢复按钮状态
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存';
    }
}

// 更新资源
async function updateResource() {
    // 获取更新按钮元素
    const updateBtn = document.getElementById('updateResourceBtn');
    // 禁用按钮防止重复提交
    updateBtn.disabled = true;
    updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 更新中...';
    
    if (!editResourceForm.checkValidity()) {
        editResourceForm.reportValidity();
        // 恢复按钮状态
        updateBtn.disabled = false;
        updateBtn.innerHTML = '<i class="fas fa-save"></i> 保存修改';
        return;
    }
            
    const id = document.getElementById('editResourceId').value;
    // 自动判断网盘名称
    const shareLink = document.getElementById('editResourceShareLink').value;
    const cloudName = matchNetdiskLink(shareLink);
    document.getElementById('editResourceCloudName').value = cloudName;
    
    const resource = {
        name: document.getElementById('editResourceName').value,
        cloud_name: cloudName,
        type: document.getElementById('editResourceType').value,
        remarks: document.getElementById('editResourceRemarks').value
    };
    
    try {
        const response = await fetch(`/api/resources/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resource)
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('更新资源成功', 'success');
            // 关闭模态框
            const editModal = bootstrap.Modal.getInstance(document.getElementById('editResourceModal'));
            editModal.hide();
            // 重新加载资源列表
            loadResources();
        } else {
            showToast('更新资源失败', 'danger');
        }
    } catch (error) {
        console.error('更新资源失败:', error);
        showToast('更新资源失败', 'danger');
    } finally {
        // 恢复按钮状态
        updateBtn.disabled = false;
        updateBtn.innerHTML = '<i class="fas fa-save"></i> 保存修改';
    }
}

// 批量保存资源
async function batchSaveResources() {
    // 获取批量添加按钮元素
    const batchBtn = document.getElementById('batchSaveResourceBtn');
    // 禁用按钮防止重复提交
    batchBtn.disabled = true;
    batchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 批量添加中...';
    
    const content = document.getElementById('batchResourceContent').value.trim();
    if (!content) {
        showToast('请输入要添加的资源内容', 'warning');
        // 恢复按钮状态
        batchBtn.disabled = false;
        batchBtn.innerHTML = '<i class="fas fa-save"></i> 批量添加';
        return;
    }
            
    // 解析输入的内容
    const resources = parseBatchResources(content);
    if (resources.length === 0) {
        showToast('解析失败，请检查输入格式是否正确', 'danger');
        return;
    }
    
    // 检查批量添加数量是否超过100条
    if (resources.length > 100) {
        showToast('批量添加数量不能超过100条，请分批添加', 'warning');
        // 恢复按钮状态
        batchBtn.disabled = false;
        batchBtn.innerHTML = '<i class="fas fa-save"></i> 批量添加';
        return;
    }
    
    const type = document.getElementById('batchResourceType').value;
    const remarks = document.getElementById('batchResourceRemarks').value;
    
    // 获取转存网盘的选择
    const saveToNetdisk = {
        quark: document.getElementById('batchSaveToQuark').checked,
        baidu: document.getElementById('batchSaveToBaidu').checked,
        ali: document.getElementById('batchSaveToAli').checked,
        xunlei: document.getElementById('batchSaveToXunlei').checked,
        uc: document.getElementById('batchSaveToUc').checked,
        '115': document.getElementById('batchSaveTo115').checked
    };
    
    // 添加公共字段
    const resourcesWithCommonFields = resources.map(resource => ({
        ...resource,
        type: type || resource.type,
        remarks: remarks || resource.remarks,
        save_to_netdisk: saveToNetdisk
    }));
    
    try {
        // 批量添加资源
        let successCount = 0;
        for (const resource of resourcesWithCommonFields) {
            const response = await fetch('/api/resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(resource)
            });
            const data = await response.json();
            if (data.success) {
                successCount++;
            }
        }
        
        showToast(`批量添加完成，成功 ${successCount} 条，失败 ${resources.length - successCount} 条`, 'success');
        
        // 关闭模态框并重置表单
        const batchModal = bootstrap.Modal.getInstance(document.getElementById('batchAddResourceModal'));
        batchModal.hide();
        document.getElementById('batchAddResourceForm').reset();
        
        // 重新加载资源列表
        loadResources();
    } catch (error) {
        console.error('批量添加资源失败:', error);
        showToast('批量添加资源失败', 'danger');
    } finally {
        // 恢复按钮状态
        batchBtn.disabled = false;
        batchBtn.innerHTML = '<i class="fas fa-save"></i> 批量添加';
    }
}

// 解析批量输入的资源
function parseBatchResources(content) {
    const resources = [];
    const lines = content.split('\n');
    
    let currentResource = {};
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        // 匹配标题行
        const titleMatch = line.match(/^标题:\s*(.+)$/);
        if (titleMatch) {
            // 如果已经有当前资源且标题和链接都存在，先保存
            if (currentResource.name && currentResource.share_link) {
                resources.push(currentResource);
                currentResource = {};
            }
            currentResource.name = titleMatch[1].trim();
            continue;
        }
        
        // 匹配分享链接行
        const linkMatch = line.match(/^分享链接:\s*(.+)$/);
        if (linkMatch) {
            currentResource.share_link = linkMatch[1].trim();
            // 自动判断网盘名称（如果用户没有提供的话）
            if (!currentResource.cloud_name) {
                currentResource.cloud_name = matchNetdiskLink(currentResource.share_link);
            }
            continue;
        }
        
        // 匹配云盘名称行
        const cloudMatch = line.match(/^云盘名称:\s*(.+)$/);
        if (cloudMatch) {
            currentResource.cloud_name = cloudMatch[1].trim();
            continue;
        }
        
        // 匹配类型行
        const typeMatch = line.match(/^类型:\s*(.+)$/);
        if (typeMatch) {
            currentResource.type = typeMatch[1].trim();
            continue;
        }
        
        // 匹配备注行
        const remarksMatch = line.match(/^备注:\s*(.+)$/);
        if (remarksMatch) {
            currentResource.remarks = remarksMatch[1].trim();
            continue;
        }
    }
    
    // 保存最后一个资源
    if (currentResource.name && currentResource.share_link) {
        resources.push(currentResource);
    }
    
    return resources;
}

// 显示 Toast 消息
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    
    // 创建 Toast 元素
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0 position-fixed bottom-0 end-0 m-3`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // 添加到容器
    toastContainer.appendChild(toast);
    
    // 显示 Toast
    const bootstrapToast = new bootstrap.Toast(toast);
    bootstrapToast.show();
    
    // 3秒后自动移除
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// CSV 导出功能

// 将数据转换为 CSV 格式
function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = ['ID', '标题', '分享链接', '云盘名称', '类型', '备注'];
    const csvContent = [headers.join(',')];
    
    data.forEach(resource => {
        const row = [
            resource.id,
            `"${resource.name.replace(/"/g, '""')}"`,
            `"${resource.share_link.replace(/"/g, '""')}"`,
            `"${resource.cloud_name.replace(/"/g, '""')}"`,
            `"${resource.type.replace(/"/g, '""')}"`,
            `"${(resource.remarks || '').replace(/"/g, '""')}"`
        ];
        csvContent.push(row.join(','));
    });
    
    return csvContent.join('\n');
}

// 下载 CSV 文件
function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 导出当前页数据
function exportCurrentPage() {
    if (resourcesData.length === 0) {
        showToast('当前页没有数据可导出', 'warning');
        return;
    }
    
    const csvContent = convertToCSV(resourcesData);
    const filename = `资源列表_当前页_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(csvContent, filename);
    showToast('当前页数据导出成功');
}

// 导出所有页数据
async function exportAllPages() {
    // 添加二次确认
    if (!confirm('确定要导出全部数据吗？这可能需要一些时间，具体取决于数据量大小。')) {
        return;
    }
    
    const searchKeyword = searchInput.value.trim();
    let allData = [];
    let currentPageNum = 1;
    
    try {
        // 先获取第一页数据，了解总页数
        const firstPageResponse = await fetch(`/api/resources?page=1&page_size=${pageSize}&search=${encodeURIComponent(searchKeyword)}`);
        const firstPageData = await firstPageResponse.json();
        
        if (!firstPageData.success) {
            showToast('导出失败：' + firstPageData.message, 'danger');
            return;
        }
        
        allData = allData.concat(firstPageData.data.items);
        const totalPagesNum = firstPageData.data.total_pages;
        
        // 如果只有一页，直接导出
        if (totalPagesNum === 1) {
            const csvContent = convertToCSV(allData);
            const filename = `资源列表_全部_${new Date().toISOString().slice(0, 10)}.csv`;
            downloadCSV(csvContent, filename);
            showToast('全部数据导出成功');
            return;
        }
        
        // 批量获取剩余页数据
        const promises = [];
        for (let i = 2; i <= totalPagesNum; i++) {
            promises.push(
                fetch(`/api/resources?page=${i}&page_size=${pageSize}&search=${encodeURIComponent(searchKeyword)}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            allData = allData.concat(data.data.items);
                        }
                    })
            );
        }
        
        await Promise.all(promises);
        
        const csvContent = convertToCSV(allData);
        const filename = `资源列表_全部_${new Date().toISOString().slice(0, 10)}.csv`;
        downloadCSV(csvContent, filename);
        showToast('全部数据导出成功');
    } catch (error) {
        console.error('导出全部数据失败:', error);
        showToast('导出全部数据失败', 'danger');
    }
}

// 为按钮添加事件监听器
document.addEventListener('DOMContentLoaded', () => {
    // 已有的初始化代码...
    
    // 导出当前页按钮
    const exportCurrentPageBtn = document.getElementById('exportCurrentPageBtn');
    if (exportCurrentPageBtn) {
        exportCurrentPageBtn.addEventListener('click', exportCurrentPage);
    }
    
    // 导出全部按钮
    const exportAllPagesBtn = document.getElementById('exportAllPagesBtn');
    if (exportAllPagesBtn) {
        exportAllPagesBtn.addEventListener('click', exportAllPages);
    }
});