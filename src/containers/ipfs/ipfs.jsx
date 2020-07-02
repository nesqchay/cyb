import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import {
  Pane,
  SearchItem,
  Tablist,
  TableEv as Table,
  Rank,
  Text,
} from '@cybercongress/gravity';
import { connect } from 'react-redux';
import ReactMarkdown from 'react-markdown';
import Iframe from 'react-iframe';
import { useQuery } from '@apollo/react-hooks';
import { ObjectInspector, chromeDark } from '@tableflip/react-inspector';
import gql from 'graphql-tag';
import { search, getRankGrade } from '../../utils/search/utils';
import { Dots, TabBtn, Loading, TextTable, Cid } from '../../components';
import CodeBlock from './codeBlock';
import Noitem from '../account/noItem';
import { formatNumber, trimString, formatCurrency } from '../../utils/utils';
import { PATTERN_HTTP } from '../../utils/config';
import {
  DiscussionTab,
  CommunityTab,
  AnswersTab,
  ContentTab,
  OptimisationTab,
  MetaTab,
} from './tab';
import ActionBarContainer from '../Search/ActionBarContainer';
import ContentItem from './contentItem';
const dateFormat = require('dateformat');

const FileType = require('file-type');

const testData = {
  data: { type: 'Buffer', data: [8, 1] },
  links: [],
  cid: 'QmYPNmahJAvkMTU6tDx5zvhEkoLzEFeTDz6azDCSNqzKkW',
  size: 10016715,
};

const objectInspectorTheme = {
  ...chromeDark,
  BASE_FONT_SIZE: '13px',
  BASE_LINE_HEIGHT: '19px',
  TREENODE_FONT_SIZE: '13px',
  TREENODE_LINE_HEIGHT: '19px',
};

const GradeTooltipContent = ({ grade, color, rank }) => (
  <Pane paddingX={15} paddingY={15}>
    <Pane marginBottom={12}>
      <Text>Answer rank is {rank}</Text>
    </Pane>
    <Pane display="flex" marginBottom={12}>
      <Text>
        Answers between &nbsp;
        {grade.from}
        &nbsp; and &nbsp;
        {grade.to}
        &nbsp; recieve grade
        <Pill
          paddingX={8}
          paddingY={5}
          width={25}
          height={16}
          display="inline-flex"
          marginLeft={5}
          alignItems="center"
          style={{ color: '#fff', backgroundColor: color }}
          isSolid
        >
          {grade.value}
        </Pill>
      </Text>
    </Pane>
    <Pane>
      <Text>
        More about{' '}
        <Link
          textDecoration="none"
          href="https://ipfs.io/ipfs/QmceNpj6HfS81PcCaQXrFMQf7LR5FTLkdG9sbSRNy3UXoZ"
          color="green"
          cursor="pointer"
          target="_blank"
        >
          cyber~Rank
        </Link>
      </Text>
    </Pane>
  </Pane>
);

const Pill = ({ children, active, ...props }) => (
  <Pane
    display="flex"
    fontSize="14px"
    borderRadius="20px"
    height="20px"
    paddingY="5px"
    paddingX="8px"
    alignItems="center"
    lineHeight="1"
    justifyContent="center"
    backgroundColor={active ? '#000' : '#36d6ae'}
    color={active ? '#36d6ae' : '#000'}
    {...props}
  >
    {children}
  </Pane>
);

function Ipfs({ nodeIpfs, mobile }) {
  const { cid } = useParams();
  const location = useLocation();

  const GET_FROM_LINK = gql`
  query MyQuery {
      cyberlink(
        where: {
          object_to: { _eq: "${cid}" }
        },
        order_by: {timestamp: desc}
      ) {
        subject
        object_from
        object_to
        timestamp
      }
    }
  `;
  const GET_TO_LINK = gql`
  query MyQuery {
      cyberlink(
        where: {
          object_from: { _eq: "${cid}" }
        },
        order_by: {timestamp: desc}
      ) {
        subject
        object_from
        object_to
        timestamp
      }
    }
  `;

  const GET_LINK = gql`
  query MyQuery {
      cyberlink(where: {_or: [{object_to: {_eq: "${cid}"}}, {object_from: {_eq: "${cid}"}}]}, order_by: {timestamp: desc}) {
        subject
      }
    }
  `;

  const [content, setContent] = useState('');
  const [typeContent, setTypeContent] = useState('');
  const [communityData, setCommunityData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('answers');
  const [gateway, setGateway] = useState(null);
  const [dataToLink, setDataToLink] = useState([]);
  const [metaData, setMetaData] = useState({
    type: 'file',
    size: 0,
    blockSizes: [],
    data: '',
  });
  const [textBtn, setTextBtn] = useState(false);
  const { data: dataFromLink, loading: loadingFromLink } = useQuery(
    GET_FROM_LINK
  );
  const { data: dataQueryToLink } = useQuery(GET_TO_LINK);
  const { data: dataQueryCommunity } = useQuery(GET_LINK);

  let contentTab;

  useEffect(() => {
    const feacData = async () => {
      setLoading(true);
      if (nodeIpfs !== null) {
        const responseDag = await nodeIpfs.dag.get(cid, {
          localResolve: false,
        });
        console.log('responseDag', responseDag);
        const link = [];
        if (responseDag.value.Links && responseDag.value.Links.length > 0) {
          responseDag.value.Links.forEach((item, index) => {
            if (item.Name.length > 0) {
              link.push({ name: item.Name, size: item.Tsize });
            } else {
              link.push(item.Tsize);
            }
          });
        }
        setMetaData(item => ({
          ...item,
          size: responseDag.value.size,
          blockSizes: link,
        }));
        if (responseDag.value.size < 1 * 10 ** 6) {
          const responseCat = await nodeIpfs.cat(cid);
          setMetaData(item => ({
            ...item,
            data: responseCat,
          }));
          console.log('responseCat', responseCat);
          const bufs = [];
          bufs.push(responseCat);
          const data = Buffer.concat(bufs);
          const dataFileType = await FileType.fromBuffer(data);
          if (dataFileType !== undefined) {
            const { mime } = dataFileType;
            const dataBase64 = data.toString('base64');
            if (mime.indexOf('image') !== -1) {
              const file = `data:${mime};base64,${dataBase64}`;
              setTypeContent('image');
              setContent(file);
              setGateway(false);
            } else {
              setGateway(true);
            }
          } else {
            const dataBase64 = data.toString();
            if (dataBase64.match(PATTERN_HTTP)) {
              setTypeContent('link');
            } else {
              setTypeContent('text');
            }

            setContent(dataBase64);
            setGateway(false);
          }
        } else {
          setGateway(true);
        }
        setLoading(false);
      } else {
        setLoading(false);
        setGateway(true);
      }
    };
    feacData();
  }, [cid]);

  useEffect(() => {
    const feacData = async () => {
      const responseSearch = await search(cid);
      setDataToLink(responseSearch);
    };
    feacData();
  }, [cid]);

  useEffect(() => {
    let dataTemp = {};
    if (dataQueryCommunity && dataQueryCommunity.cyberlink.length > 0) {
      dataQueryCommunity.cyberlink.forEach(item => {
        if (dataTemp[item.subject]) {
          dataTemp[item.subject].amount += 1;
        } else {
          dataTemp = {
            ...dataTemp,
            [item.subject]: {
              amount: 1,
            },
          };
        }
      });
      setCommunityData(dataTemp);
    }
  }, [dataQueryCommunity]);

  useEffect(() => {
    chekPathname();
  }, [location.pathname]);

  const chekPathname = () => {
    const { pathname } = location;

    if (
      pathname.match(/optimisation/gm) &&
      pathname.match(/optimisation/gm).length > 0
    ) {
      setSelected('optimisation');
    } else if (
      pathname.match(/community/gm) &&
      pathname.match(/community/gm).length > 0
    ) {
      setSelected('community');
    } else if (
      pathname.match(/discussion/gm) &&
      pathname.match(/discussion/gm).length > 0
    ) {
      setTextBtn('add comment');
      setSelected('discussion');
    } else if (
      pathname.match(/meta/gm) &&
      pathname.match(/meta/gm).length > 0
    ) {
      setSelected('meta');
    } else {
      setTextBtn('add answer');
      setSelected('answers');
    }
  };

  if (loading) {
    return (
      <div
        style={{
          width: '100%',
          height: '50vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
        }}
      >
        <Loading />
      </div>
    );
  }

  if (selected === 'optimisation') {
    contentTab = (
      <OptimisationTab
        data={dataFromLink}
        mobile={mobile}
        nodeIpfs={nodeIpfs}
      />
    );
  }

  if (selected === 'answers') {
    contentTab = (
      <AnswersTab data={dataToLink} mobile={mobile} nodeIpfs={nodeIpfs} />
    );
  }

  if (selected === 'community') {
    contentTab = <CommunityTab data={communityData} />;
  }

  if (selected === 'discussion') {
    contentTab = (
      <DiscussionTab
        data={dataQueryToLink}
        mobile={mobile}
        nodeIpfs={nodeIpfs}
      />
    );
  }

  // if (selected === 'content') {
  //   contentTab = (
  //     <ContentTab
  //       typeContent={typeContent}
  //       gateway={gateway}
  //       content={content}
  //       cid={cid}
  //     />
  //   );
  // }

  if (selected === 'meta') {
    contentTab = <MetaTab cid={cid} data={metaData} />;
  }

  return (
    <>
      <main
        className="block-body"
        style={{
          minHeight: 'calc(100vh - 70px)',
          paddingBottom: '5px',
          height: '1px',
          width: '100%',
        }}
      >
        <ContentTab
          typeContent={typeContent}
          gateway={gateway}
          content={content}
          cid={cid}
        />
        <Tablist
          display="grid"
          gridTemplateColumns="repeat(auto-fit, minmax(110px, 1fr))"
          gridGap="10px"
          marginY={25}
        >
          <TabBtn
            // text="discussion"
            text={
              <Pane display="flex" alignItems="center">
                <Pane>discussion</Pane>
                {dataQueryToLink && dataQueryToLink.cyberlink.length > 0 && (
                  <Pill marginLeft={5} active={selected === 'discussion'}>
                    {formatNumber(dataQueryToLink.cyberlink.length)}
                  </Pill>
                )}
              </Pane>
            }
            isSelected={selected === 'discussion'}
            to={`/ipfs/${cid}/discussion`}
          />
          {/* <TabBtn
          text="content"
          isSelected={selected === 'content'}
          to={`/ipfs/${cid}`}
        /> */}
          <TabBtn
            // text="optimisation"
            text={
              <Pane display="flex" alignItems="center">
                <Pane>optimisation</Pane>
                {dataFromLink && dataFromLink.cyberlink.length > 0 && (
                  <Pill marginLeft={5} active={selected === 'optimisation'}>
                    {formatNumber(dataFromLink.cyberlink.length)}
                  </Pill>
                )}
              </Pane>
            }
            isSelected={selected === 'optimisation'}
            to={`/ipfs/${cid}/optimisation`}
          />
          <TabBtn
            // text="answers"
            text={
              <Pane display="flex" alignItems="center">
                <Pane>answers</Pane>
                {dataToLink.length > 0 && (
                  <Pill marginLeft={5} active={selected === 'answers'}>
                    {formatNumber(dataToLink.length)}
                  </Pill>
                )}
              </Pane>
            }
            isSelected={selected === 'answers'}
            to={`/ipfs/${cid}`}
          />
          <TabBtn
            // text="community"
            text={
              <Pane display="flex" alignItems="center">
                <Pane>community</Pane>
                {Object.keys(communityData).length > 0 && (
                  <Pill marginLeft={5} active={selected === 'community'}>
                    {formatNumber(Object.keys(communityData).length)}
                  </Pill>
                )}
              </Pane>
            }
            isSelected={selected === 'community'}
            to={`/ipfs/${cid}/community`}
          />
          <TabBtn
            text="meta"
            isSelected={selected === 'meta'}
            to={`/ipfs/${cid}/meta`}
          />
        </Tablist>
        {contentTab}
      </main>
      {!mobile && (selected === 'discussion' || selected === 'answers') && (
        <ActionBarContainer textBtn={textBtn} keywordHash={cid} />
      )}
    </>
  );
}

const mapStateToProps = store => {
  return {
    nodeIpfs: store.ipfs.ipfs,
    mobile: store.settings.mobile,
  };
};

export default connect(mapStateToProps)(Ipfs);
