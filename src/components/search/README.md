# 搜索组件

本目录包含与搜索功能相关的组件。

## 组件列表

### SearchBar

搜索栏组件，用于输入搜索关键词。

**主要功能**：
- 支持文本输入
- 支持语音输入
- 支持搜索建议
- 支持搜索历史

### SearchResults

搜索结果组件，用于显示搜索结果。

**主要功能**：
- 显示搜索结果列表
- 支持结果分类
- 支持结果高亮
- 支持结果排序

### SearchFilters

搜索过滤器组件，用于设置搜索过滤条件。

**主要功能**：
- 设置搜索范围
- 设置搜索类型
- 设置时间范围
- 设置标签过滤

### MultiModalSearch

多模态搜索组件，支持多种搜索方式。

**主要功能**：
- 支持文本搜索
- 支持语音搜索
- 支持图像搜索
- 支持手写搜索

### SearchHistory

搜索历史组件，用于显示和管理搜索历史。

**主要功能**：
- 显示搜索历史列表
- 支持历史记录点击
- 支持历史记录删除
- 支持历史记录清空

### SearchSuggestions

搜索建议组件，用于显示搜索建议。

**主要功能**：
- 显示热门搜索
- 显示相关搜索
- 显示搜索补全
- 支持建议点击

### UnifiedSearchBar

统一搜索栏组件，整合了HomeSearchBar、CategorySearchBar和CommunitySearchBar的功能。

**主要功能**：
- 支持不同搜索范围（首页、分类、社区）
- 自动适配不同场景的占位文本
- 自动导航到对应的搜索结果页面
- 支持自定义样式和回调函数
- 集成多模态搜索功能

## 使用方法

### 使用统一搜索栏

```javascript
import { UnifiedSearchBar, SearchResults } from '../components/search';

function HomeScreen() {
  const handleSearch = (results, query, options) => {
    console.log('搜索结果:', results);
    console.log('搜索关键词:', query);
    console.log('搜索选项:', options);
  };

  return (
    <View style={styles.container}>
      <UnifiedSearchBar
        searchScope="home"
        resultScreenName="SearchResults"
        onSearch={handleSearch}
      />

      {/* 其他内容 */}
    </View>
  );
}

function CommunityScreen() {
  const handleSearch = (results) => {
    if (results && results.length > 0) {
      navigation.navigate('CommunitySearch', { results });
    }
  };

  return (
    <View style={styles.container}>
      <UnifiedSearchBar
        searchScope="community"
        resultScreenName="CommunitySearch"
        onSearch={handleSearch}
      />

      {/* 其他内容 */}
    </View>
  );
}
```

### 使用多模态搜索

```javascript
import { MultiModalSearch, SearchResults } from '../components/search';

function SearchScreen() {
  const [results, setResults] = useState([]);

  const handleSearch = (searchResults, query, options) => {
    setResults(searchResults);
  };

  return (
    <View style={styles.container}>
      <MultiModalSearch
        searchScope="home"
        onSearch={handleSearch}
        onCancel={() => navigation.goBack()}
      />

      <SearchResults
        results={results}
        onResultPress={handleResultPress}
      />
    </View>
  );
}
```
