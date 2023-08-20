reference : https://techblog.woowahan.com/2687/

# DB 분산처리를 위한 Sharding

## DB Sharding

- 하나의 DB에 데이터가 늘어나면 용량 이슈 발생, CRUD는 자연스레 서비스 성능에 영향을 끼침.
- DB 분산시 "특정 DB의 장애"가 전면장애로 이어지지 않는점도 샤딩의 장점 중 하나.

### 모듈러샤딩 & 레인지샤딩 알아보기

#### 모듈러샤딩

https://techblog.woowahan.com/wp-content/uploads/img/2020-07-06/thiiing-db-modular-sharding.png
ref : https://techblog.woowahan.com/2687/

- 모듈러샤딩은 PK를 모듈러 연산한 결과를 DB로 특정하는 방식.
- 장점: 레인지샤딩에 비해 균산적으로 데이터가 분배됨.
- 단점: DB를 추가 증설하는 경우 이미 적재된 데이터의 재정렬이 필요함.

모둘러 샤딩은 데이터량이 일정 수준에서 유지될 것으로 예상되는 데이터 성격을 가진 곳에 적용할 때 어울리는 방식.
물론, 데이터가 꾸준히 증가되는 환경이더라도 적재속도가 그리 빠르지 않다면 모듈러방식을 통해 분산처리하는 것도 고려해볼 법 하다.
무엇보다 데이터가 <b> 균일 </b> 하게 분산된다는 것은 트래픽을 안정적으로 소화하면서도 DB리소스를 최대한 활용할 수 있는 방법.

### 레인지 샤딩

https://techblog.woowahan.com/wp-content/uploads/img/2020-07-06/thiiing-db-range-sharding.png
ref : https://techblog.woowahan.com/2687/

레인지 샤딩은 PK의 "범위"를 기준으로 DB를 특정하는 방식.

- 장점: 모듈러샤딩에 비해 기본적으로 증설에 재정렬 비용이 들지 않음.
- 단점: 일부 DB에 데이터가 몰릴 수 있다. -> 특정 레인지를 크게 잡을 경우, 특정 서버에만 데이터가 몰릴 수 있다.

레인지샤딩의 가장 큰 장점은 증설작업에 드는 비용이 크지 않다는 점. 데이터가 급격히 증가할 여지가 있다면 레인지샤딩도 좋은 선택안.
다만, 단점으로 주로 활성 유저가 몰린 DB로 트래픽이나 데이터량이 몰릴 수 있음.

책에서 레이디가가, 저스틴 비버 등 특정 유명인사가 몰린 샤드가 있고, 소셜 어플리케이션 서비스를 구축한다면 해당 샤드에만 특정 트래픽이 몰리는 경우를 살펴볼 수 있었음
-> 기껏 분산처리를 해놨음에도 불구하고 또다시 부하를 분산시키기 위한 이중작업이 요구시됨.
-> 하지만, 반대로 트래픽이 현저하게 적은 서버의 경우에는 통합을 고려해야함

## Router

- 모듈러와 레인지방식이 어떤 기준으로 데이터를 분산시킬지에 대한 명세를 정의한거라면, 실제로 분산된 DB에 접근하기 위한 논리적인 작업을 라우터가 수행.

# 구현

## Sharding Strategy

```
public enum ShardingStrategy implements IdentityComparable<ShardingStrategy> { // [1]
    RANGE, MODULAR
}
```

- IdentityComparable은 enum의 비교연산을 쉽게 하기 위해 인터페이스.

## yaml 설정

- 운영시 설정정보 변경만으로 쉽게 샤딩을 적용할 수 있도록 yaml을 정의합니다.

<b>데이터소스 설정</b>

```
datasource: // [1]
  friend:
    shards: // [2]
      - username
        password
        master:
          name: master-friend
          url
        slaves: // [3]
          - name: slave-friend-1
            url
      - username
        password
        master:
          name: master-friend-2
          url
        slaves:
          - name: slave-friend-1
            url
```

- 1. DB 접속 정보를 가진 데이터소스를 우선 등록합니다.
- 2. friend DB의 샤드를 두 개로 나눴습니다. (username, password)
- 3. slave DB는 여러 대 가질 수 있도록 slave-[moduleName]-[index]형태의 이름을 가지며 RoundRobin으로 밸런싱해줍니다. (특정 서버에만 샤딩이 되지 않게 골고루 퍼지도록 하기 위함)

### 레인지샤딩 룰 설정

- friend DB에 레인지샤딩을 적용한 예시.

```
sharding: // [1]
  friend:
    strategy: RANGE // [2]
    rules: // [3]
      - shard_no: 0
        range_min: 0
        range_max: 1000
      - shard_no: 1
        range_min: 1001
        range_max: 9223372036854775807
```

- 1. 데이터소스 별 샤딩룰 정의
- 2. friend DB의 경우 샤딩 전략을 range로 정의.
- 3. 샤딩 전략을 range로 선택했으므로 샤드 넘버 마다 샤딩키의 범위를 지정. shard_no의 range_max + 1은 그다음 샤드의 range_min이 됨. 그래서 마지막 샤딩 설정의 range_max는 샤딩키의 max값으로 설정해 주면 좋음. 그러면 증설을 미리 하지 못해서 발생되는 문제를 회피할 수 있고, 증설을 예약하듯 미리 설정하는 것도 가능.

### 모듈러샤딩 룰 설정

```
sharding:
  friend:
    strategy: MODULAR // [1]
    mod: 2 // [2]
```

- 1. friend DB의 샤딩 전략을 MODULAR로 선택.
- 2. 샤딩 전략을 MODULAR 로 선택한 경우는 설정이 간단. 모듈러 연산을 위한 값을 적어주면 되는데, 이 값은 현재 DB 수와 같음.

# 파티셔닝(Partitioning)

### 배경

- 서비스의 크기가 점점 커지고, DB에 저장하는 데이터의 규모 또한 대용량화 되면서 기존에 사용하는 DB시스템의 용량의 한계와 성능의 저하를 가져오게 됨.
- 즉, 하나의 DB에 너무 많은 테이블들이 들어있게 되면 용량/성능 이슈가 발생하고 이런 이슈를 해결하기 위해 table을 파티션이라는 작은 단위로 나누어 관리하는 파티셔닝 기법이 나옴.

### 개념

- 논리적인 데이터 element들을 다수의 entity로 쪼개는 행위를 뜻하는 일반적인 용어
- 즉, 큰 테이블이나 인덱스를 관리하기 쉬운 파티션이라는 작은 단위로 물리적으로 분할.

### 목적

- 특정 DML (Data Manipulation Language)과 쿼리의 성능 향상
- 주로 대용량 Data Write 환경에서 효율적
- 특히 전체 테이블을 조회하는 쿼리문에서 데이터 접근 범위를 줄여 성능 향상 가져옴.
- 많은 INSERT가 존재하는 시스템에서 INSERT 작업을 작은 단위인 partition들로 분산시켜 경합 줄임.

### 장점

- 관리적 측면 : 전체 데이터 소실 가능성이 줄어 데이터 가용성 향상, 파티션별 백업 및 복구 가능, 파티션 단위로 I/O 분산이 가능해 UPDATE 성능 향상
- 성능적 측면 : 데이터 검색 시 필요한 부분만 검색 가능, 필요한 데이터만 빠르게 조회 가능

### 단점

- table간 JOIN 비용 증가

### 파티셔닝 종류

#### 1. 수직적 파티셔닝 (Vertical Partitioning)

https://gmlwjd9405.github.io/images/database/horizontal-partitioning.png
ref : https://gmlwjd9405.github.io/2018/09/24/db-partitioning.html

하나의 테이블의 각 행을 다른 테이블에 분산.

- 개념 : 샤딩과 동일한 개념
- 스키마 복제후 샤드키 기준으로 데이터 분산
- 예시 : ARTICLE이라는 테이블에 id,title,writer_id,content 컬럼이 있다고 가정, 그리고 `SELECT id, title ... writer_id FROM article where..`을 수행했다고 가정하자. 중요한 점은 SELECT한 컬럼만 가져오는 것이 아니라 전체 테이블을 먼저 일괄적으로 HDD,SDD에서 스캔한 후 메모리에 올려 SELECT한 특정 컬럼을 가져옴. 따라서 content와 같이 사이즈가 클 경우엔 I/O 비용이 커짐.
- 그래서 이런 경우엔, Vertical Partitioning을 수행해 CONTENT 컬럼만 따로 분리 수행. (id, conent)
- 수직적 파티셔닝 같은 경우엔, 이미 정규화가 되더라도 효율적 쿼리문을 수행하기 위해 추가적으로 수행이 가능하다는 점 !
- 또한, 민감한 정보에 접근하지 못하도록 수행이 가능하기도 함.
- 자주 사용되는 컬럼들만 하나로 모아서 수행 가능
- 반대로, 자주 사용되지 않는 컬럼들만 모으기도 가능
- 전체 데이터가 필요할 경우 JOIN 수행

#### 2. 수평적 파티셔닝 (=샤딩, horizontal Partitioning)

https://gmlwjd9405.github.io/images/database/horizontal-partitioning.png
ref : https://gmlwjd9405.github.io/2018/09/24/db-partitioning.html

- 수직적 파티셔닝의 경우 스키마가 변경되지만 수평적 방식은 스키마는 유지 (ROW를 기준으로 분할하므로)
- 가령, SUBSCRIPTION 이라는 테이블이 있고 컬럼으로 user_id, channel_id, alarm, membership 이라는 유투브 채널 정보를 담고 있는 테이블을 생각해보자
- 해당 테이블의 경우 users (N), channel(M) 즉, 최대값으로 가질 수 있는 행의 갯수는 총 N \* M (개)
- 사용자수가 백만명, 채널수가 1000개라면....? (끔찍쓰~)
- 테이블 크기가 커질수록 테이블의 인덱스도 커지고 인덱스가 커지는 것은 조회 비용이 그만큼 커진다는 것.
- 테이블을 나눌 때 중요한 건 "파티션 키"
- 파티션 키를 기준으로 hash fucntion을 걸어 테이블을 나눔
- 따라서, 가장 많이 조회 될 컬럼을 파티션키로 설정해주는 것이 중요
- 만약에, 위에 테이블에서 usre_id로 테이블을 나누고, 해당 테이블에서 channel_id = 1 을 구독한 user들을 모두 조회하고 싶으면 channel_id는 파티션키가 아니기에 나눠진 테이블 모두 들어가서 조회를 해야함.
- channel_id가 파티션 키였다면 hash_fucntion에 걸어 특정 값만 나온 테이블을 조회만 하면 됨.
- 또한 애초에 테이블이 잘 균등하게 배분되도록 hash_function을 잘 만드는 것도 중요 (위에서 언급한 모듈러 샤딩)
