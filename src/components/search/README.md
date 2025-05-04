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

## 使用方法

```javascript
import { SearchBar, SearchResults, SearchFilters } from '../components/search';

function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [filters, setFilters] = useState({
    type: 'all',
    dateRange: null,
    tags: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    try {
      const searchResults = await searchApi.search(query, filters);
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        onSubmit={handleSearch}
        placeholder="搜索笔记、标签、内容..."
      />
      
      <SearchFilters
        filters={filters}
        onFiltersChange={setFilters}
      />
      
      <SearchResults
        results={results}
        query={query}
        isLoading={isLoading}
        onResultPress={handleResultPress}
      />
    </View>
  );
}

function MultiModalSearchScreen() {
  const [searchMode, setSearchMode] = useState('text');
  const [results, setResults] = useState([]);
  
  return (
    <View style={styles.container}>
      <MultiModalSearch
        mode={searchMode}
        onModeChange={setSearchMode}
        onSearch={handleSearch}
      />
      
      <SearchResults
        results={results}
        onResultPress={handleResultPress}
      />
    </View>
  );
}
```
