-- 数据库创建语句（如果不存在则创建）
CREATE DATABASE IF NOT EXISTS `ucmao_search` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用创建的数据库
USE `ucmao_search`;

-- ----------------------------
-- Table structure for `api_config`
-- ----------------------------
DROP TABLE IF EXISTS `api_config`;
CREATE TABLE `api_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` varchar(100) NOT NULL COMMENT 'API 名称',
  `url` varchar(255) NOT NULL COMMENT 'API URL',
  `method` varchar(10) NOT NULL COMMENT '请求方法 (GET/POST)',
  `request` text DEFAULT NULL COMMENT '原始请求参数 (JSON 字符串)',
  `response` varchar(255) DEFAULT NULL COMMENT '响应数据解析路径',
  `status` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'API 状态 (1=true, 0=false)',
  `response_time_ms` int(11) DEFAULT 0 COMMENT '最近一次测试响应时间（毫秒）',
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1 COMMENT '启用状态：1为启用，0为禁用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_api_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='API 配置信息表';

-- ----------------------------
-- Table structure for `resources`
-- ----------------------------
DROP TABLE IF EXISTS `resources`;
CREATE TABLE `resources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `file_id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `share_link` text NOT NULL,
  `cloud_name` varchar(100) NOT NULL,
  `type` varchar(50) NOT NULL,
  `remarks` text,
  `is_replaced` BOOLEAN DEFAULT FALSE,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_file_id` (`file_id`),
  UNIQUE KEY `uk_share_link` (`share_link`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- Test data for `api_config`
-- ----------------------------
INSERT INTO `api_config` (`name`, `url`, `method`, `request`, `response`, `status`, `response_time_ms`, `is_enabled`) VALUES
('qkpanso', 'https://qkpanso.com/v1/search/disk', 'post', '{"page": 1, "q": "[[keyword]]", "user": "", "exact": false, "format": [], "share_time": "", "size": 15, "type": "", "exclude_user": [], "adv_params": {"wechat_pwd": "", "platform": "pc"}}', 'data.list[*].[disk_name, link]', 0, 2412, 0),
('uuxiao', 'https://uuxiao.cn/api/user/search?name=[[keyword]]', 'get', '', 'data[*].[name, url]', 1, 378, 1),
('hhlqilongzhu', 'https://www.hhlqilongzhu.cn/api/ziyuan_nanfeng.php?keysearch=[[keyword]]', 'get', '', 'data[*].[title, data_url]', 0, 193, 0),
('ptger', 'https://files.ptger.cn/api/files/vagueQuery?name=[[keyword]]', 'get', '', 'data[*].source.[name, url]', 1, 261, 1),
('6789o', 'https://zy.6789o.com/duanjuapi/search.php?text=[[keyword]]', 'get', '', 'data[*].[name, viewlink]', 1, 203, 1),
('ahfi', 'https://api.ahfi.cn/api/short?text=[[keyword]]', 'get', '', 'data[*].[name, viewlink]', 1, 2698, 1),
('lbbb', 'https://dj.lbbb.cc/api.php?limit=20&text=[[keyword]]', 'get', '', 'datas.data[*].[name, link]', 1, 4675, 1),
('110t', 'https://ys.110t.cn/api/ajax.php?act=search&name=[[keyword]]', 'get', '', 'data[*].[name, url]', 0, 21, 0),
('ycubbs', 'https://ai-img.ycubbs.cn/api/duanju/search?name=[[keyword]]', 'get', '', 'data[*].[name, url]', 1, 651, 1),
('qsdurl', 'https://api.qsdurl.cn/tool/duanju?name=[[keyword]]', 'get', '', '[*].[name, url]', 0, 5010, 0),
('mywl', 'https://cx.mywl.top/api/duanju/search?keyword=[[keyword]]', 'get', '', 'data[*].[title, url]', 0, 124, 0),
('kuleu', 'https://api.kuleu.com/api/action?text=[[keyword]]', 'get', '', 'data[*].[name, viewlink]', 1, 345, 1),
('kuoapp', 'https://kuoapp.com/duanju/api.php?param=1&name=[[keyword]]', 'get', '', 'data[*].[name, url]', 0, 5117, 0),
('狗狗盘搜', 'https://gogopanso.com:3642/search?keyword=[[keyword]]', 'get', '', 'data[*].[name, downurl]', 1, 2962, 1),
('趣盘搜', 'https://v.funletu.com/search', 'post', '{"style": "get", "datasrc": "search", "query": {"id": "", "datetime": "", "courseid": 1, "categoryid": "", "filetypeid": "", "filetype": "", "reportid": "", "validid": "", "searchtext": "[[keyword]]", "fileid": ""}, "page": {"pageSize": 10, "pageIndex": 1}, "order": {"prop": "sort", "order": "desc"}, "message": "请求资源列表数据"}', 'data[*].[title, url]', 1, 182, 1),
('pansou', 'https://so.252035.xyz/api/search?kw=[[keyword]]', 'get', '', 'data.merged_by_type.* | [].[note, url]', 1, 5200, 1);

-- ----------------------------
-- Test data for `resources`
-- ----------------------------
INSERT INTO `resources` (`file_id`, `name`, `share_link`, `cloud_name`, `type`, `remarks`) VALUES
('file_123456', '电影资源分享', 'https://pan.baidu.com/s/1abcdefghijklmnopqrstuvwxyz123456', '百度网盘', '电影', '这是一个电影资源分享'),
('file_789012', '音乐专辑合集', 'https://www.aliyundrive.com/s/abcdefghijklmnopqrstuvwxyz', '阿里云盘', '音乐', '精选音乐专辑合集'),
('file_345678', '软件工具包', 'https://pan.quark.cn/s/abcdefghijklmnopqrstuvwxyz123456', '夸克网盘', '软件', '常用软件工具包'),
('file_901234', '学习资料', 'https://cloud.189.cn/t/abcdefghijklmnopqrstuvwxyz', '天翼云盘', '文档', '学习资料合集'),
('file_567890', '图片素材', 'https://pan.xunlei.com/s/abcdefghijklmnopqrstuvwxyz', '迅雷网盘', '图片', '高清图片素材集');
